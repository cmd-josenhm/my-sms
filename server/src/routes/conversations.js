import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { isPositiveInt } from '../util/validate.js';
import { onlineSet } from '../presence.js';

const router = Router();

router.use(requireAuth);

function otherOf(user, peerId) {
  return peerId === user.id ? null : peerId;
}

// GET /api/conversations — liste des conversations (dernier message + non-lus)
router.get('/', async (req, res) => {
  const me = req.user.id;
  const r = await query(
    `SELECT c.id,
            p.id            AS peer_id,
            p.username,
            p.display_name,
            p.avatar_color,
            p.last_seen_at,
            lm.id           AS last_id,
            lm.body         AS last_body,
            lm.created_at   AS last_at,
            lm.sender_id    AS last_sender,
            cm_peer.peer_last_read_at,
            (SELECT count(*)
               FROM messages m
              WHERE m.conversation_id = c.id
                AND m.sender_id = p.id
                AND m.created_at > cm.last_read_at) AS unread
       FROM conversations c
       JOIN users p
         ON p.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
       JOIN conversation_members cm
         ON cm.conversation_id = c.id AND cm.user_id = $1
       JOIN LATERAL (
            SELECT p2.last_read_at AS peer_last_read_at
              FROM conversation_members p2
             WHERE p2.conversation_id = c.id AND p2.user_id = p.id
          ) cm_peer ON true
       LEFT JOIN LATERAL (
            SELECT m2.id, m2.body, m2.created_at, m2.sender_id
              FROM messages m2
             WHERE m2.conversation_id = c.id
             ORDER BY m2.id DESC
             LIMIT 1
          ) lm ON true
      WHERE c.user_a = $1 OR c.user_b = $1
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.id DESC
      LIMIT 100`,
    [me]
  );
  res.json({
    conversations: r.rows.map((row) => ({
      id: row.id,
      peer: publicUser(
        {
          id: row.peer_id,
          username: row.username,
          display_name: row.display_name,
          avatar_color: row.avatar_color,
          last_seen_at: row.last_seen_at,
        },
        onlineSet.has(row.peer_id)
      ),
      lastMessage: row.last_id
        ? { id: row.last_id, body: row.last_body, createdAt: row.last_at, senderId: row.last_sender }
        : null,
      unread: Number(row.unread),
      peerLastReadAt: row.peer_last_read_at,
    })),
  });
});

// POST /api/conversations { userId } — ouvrir (ou créer) la conversation avec un utilisateur
router.post('/', async (req, res) => {
  const target = Number(req.body?.userId);
  if (!isPositiveInt(target) || target === req.user.id) {
    return res.status(400).json({ error: 'Conversation invalide.' });
  }
  try {
    const conv = await withTransaction(async (client) => {
      const r = await client.query(
        `INSERT INTO conversations (user_a, user_b)
         SELECT least($1::bigint, $2::bigint), greatest($1::bigint, $2::bigint)
         ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = excluded.user_a
         RETURNING id`,
        [req.user.id, target]
      );
      const id = r.rows[0].id;
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT DO NOTHING`,
        [id, req.user.id, target]
      );
      return { id };
    });

    const peer = await query(
      'SELECT id, username, display_name, avatar_color, last_seen_at FROM users WHERE id = $1',
      [target]
    );
    if (peer.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    res.status(201).json({
      conversation: {
        id: conv.id,
        peer: publicUser(peer.rows[0], onlineSet.has(target)),
        lastMessage: null,
        unread: 0,
        peerLastReadAt: null,
      },
    });
  } catch (err) {
    // 23503 = référence à un utilisateur inexistant
    if (err.code === '23503') return res.status(404).json({ error: 'Utilisateur introuvable.' });
    console.error('[conversations:create]', err);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard.' });
  }
});

// GET /api/conversations/:id/messages?before=<id>&limit=50 — historique paginé
router.get('/:id/messages', async (req, res) => {
  const convId = Number(req.params.id);
  if (!isPositiveInt(convId)) return res.status(400).json({ error: 'Conversation invalide.' });

  const beforeRaw = req.query.before;
  const before = beforeRaw === undefined ? null : Number(beforeRaw);
  if (before !== null && !isPositiveInt(before)) {
    return res.status(400).json({ error: 'Paramètre before invalide.' });
  }
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const membership = await query(
    'SELECT 1 FROM conversations WHERE id = $1 AND (user_a = $2 OR user_b = $2)',
    [convId, req.user.id]
  );
  if (membership.rows.length === 0) {
    return res.status(404).json({ error: 'Conversation introuvable.' });
  }

  const r = await query(
    `SELECT id, sender_id, body, created_at
       FROM messages
      WHERE conversation_id = $1 AND ($2::bigint IS NULL OR id < $2)
      ORDER BY id DESC
      LIMIT $3`,
    [convId, before, limit + 1]
  );

  const hasMore = r.rows.length > limit;
  const items = r.rows.slice(0, limit).reverse().map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  }));
  res.json({ messages: items, hasMore });
});

export default router;
