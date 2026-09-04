import cookie from 'cookie';
import crypto from 'node:crypto';
import { query } from './db.js';
import { markOnline, markOffline, onlineSet } from './presence.js';
import { makeThrottle } from './util/ratelimit.js';
import { cleanMessage, isPositiveInt } from './util/validate.js';

const messageThrottle = makeThrottle({ windowMs: 10_000, max: 30 });
const typingThrottle = makeThrottle({ windowMs: 1_500, max: 2 });

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function peerOf(conversation, me) {
  return conversation.user_a === me ? conversation.user_b : conversation.user_a;
}

async function getMembership(conversationId, userId) {
  const r = await query(
    'SELECT user_a, user_b FROM conversations WHERE id = $1 AND (user_a = $2 OR user_b = $2)',
    [conversationId, userId]
  );
  return r.rows[0] || null;
}

/**
 * Branche Socket.IO sur l'app HTTP existante.
 * Auth : même cookie httpOnly que l'API (handshake sur l'origine même).
 */
export function setupSockets(httpServer, io) {
  io.use((socket, next) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = cookies.token;
    if (!token) return next(new Error('unauthorized'));
    query('SELECT id FROM users WHERE auth_token_hash = $1', [sha256(token)])
      .then((r) => {
        if (r.rows.length === 0) return next(new Error('unauthorized'));
        socket.data.userId = r.rows[0].id;
        next();
      })
      .catch(() => next(new Error('unauthorized')));
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    socket.join(`user:${me}`);
    markOnline(me);
    query('UPDATE users SET last_seen_at = now() WHERE id = $1', [me]);

    // Notifier uniquement les interlocuteurs directs (pas tout le monde).
    query(
      `SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS peer
         FROM conversations WHERE user_a = $1 OR user_b = $1`,
      [me]
    ).then((r) => {
      const now = new Date().toISOString();
      for (const { peer } of r.rows) {
        io.to(`user:${peer}`).emit('presence', { userId: me, online: true, lastSeenAt: now });
      }
    });

    // Presence heartbeat : rafraîchit last_seen_at tant que la session vit.
    const heartbeat = setInterval(() => {
      query('UPDATE users SET last_seen_at = now() WHERE id = $1', [me]).catch(() => {});
    }, 60_000);
    heartbeat.unref?.();

    socket.on('message:send', (payload, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};
      const body = cleanMessage(payload?.body);
      const conversationId = Number(payload?.conversationId);
      if (!body || !isPositiveInt(conversationId)) {
        return respond({ ok: false, error: 'Message invalide.' });
      }
      if (!messageThrottle(`msg:${socket.id}`)) {
        return respond({ ok: false, error: 'slow' });
      }
      (async () => {
        const conv = await getMembership(conversationId, me);
        if (!conv) return respond({ ok: false, error: 'Conversation introuvable.' });
        const peer = peerOf(conv, me);
        const r = await query(
          `INSERT INTO messages (conversation_id, sender_id, body)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, body, created_at`,
          [conversationId, me, body]
        );
        const message = {
          id: r.rows[0].id,
          conversationId: r.rows[0].conversation_id,
          senderId: r.rows[0].sender_id,
          body: r.rows[0].body,
          createdAt: r.rows[0].created_at,
        };
        respond({ ok: true, message });
        io.to(`user:${peer}`).emit('message:new', { message, tempId: payload?.tempId ?? null });
      })().catch((err) => {
        console.error('[message:send]', err.message);
        respond({ ok: false, error: 'Erreur serveur.' });
      });
    });

    socket.on('conversation:read', (payload, ack) => {
      const respond = typeof ack === 'function' ? ack : () => {};
      const conversationId = Number(payload?.conversationId);
      const messageId = Number(payload?.messageId);
      if (!isPositiveInt(conversationId) || !isPositiveInt(messageId)) {
        return respond({ ok: false, error: 'Lecture invalide.' });
      }
      (async () => {
        const conv = await getMembership(conversationId, me);
        if (!conv) return respond({ ok: false, error: 'Conversation introuvable.' });
        // On ne recule jamais le curseur de lecture.
        await query(
          `UPDATE conversation_members
              SET last_read_at = now()
            WHERE conversation_id = $1 AND user_id = $2
              AND last_read_at < (SELECT COALESCE(MAX(created_at), 'epoch'::timestamptz)
                                    FROM messages
                                   WHERE conversation_id = $1 AND sender_id = $3 AND id <= $4)`,
          [conversationId, me, peerOf(conv, me), messageId]
        );
        respond({ ok: true });
        io.to(`user:${peerOf(conv, me)}`).emit('messages:read', {
          conversationId,
          readerId: me,
          readAt: new Date().toISOString(),
        });
      })().catch((err) => {
        console.error('[conversation:read]', err.message);
        respond({ ok: false, error: 'Erreur serveur.' });
      });
    });

    socket.on('typing', (payload) => {
      const conversationId = Number(payload?.conversationId);
      if (!isPositiveInt(conversationId)) return;
      if (!typingThrottle(`typing:${socket.id}:${conversationId}`)) return;
      getMembership(conversationId, me)
        .then((conv) => {
          if (!conv) return;
          io.to(`user:${peerOf(conv, me)}`).emit('typing', {
            conversationId,
            fromId: me,
          });
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      clearInterval(heartbeat);
      const wasSolo = onlineSet.size === 1;
      markOffline(me);
      if (wasSolo) {
        query('UPDATE users SET last_seen_at = now() WHERE id = $1', [me])
          .then(() => {
            query(
              `SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS peer
                 FROM conversations WHERE user_a = $1 OR user_b = $1`,
              [me]
            ).then((r) => {
              const now = new Date().toISOString();
              for (const { peer } of r.rows) {
                io.to(`user:${peer}`).emit('presence', { userId: me, online: false, lastSeenAt: now });
              }
            });
          })
          .catch(() => {});
      }
    });
  });
}
