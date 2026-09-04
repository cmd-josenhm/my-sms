import crypto from 'node:crypto';
import cookie from 'cookie';
import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { config } from './config.js';

export const AVATAR_COLORS = [
  '#0e9f6e', '#6366f1', '#e11d48', '#d97706',
  '#0891b2', '#9333ea', '#db2777', '#2563eb',
];

export function avatarColorFor(id) {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** Jeton opaque révocable (sha256 stocké en base, un jeton actif par utilisateur). */
export function newToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setAuthCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: Math.floor(config.tokenTtlMs / 1000),
    })
  );
}

export function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize('token', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: 0,
    })
  );
}

export async function issueSession(res, userId) {
  const token = newToken();
  await query(
    'UPDATE users SET auth_token_hash = $1 WHERE id = $2',
    [hashToken(token), userId]
  );
  setAuthCookie(res, token);
}

/** middleware Express : exige une session valide, attache req.user (sans mot de passe). */
export function requireAuth(req, res, next) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  query('SELECT id, email, username, display_name, avatar_color, last_seen_at FROM users WHERE auth_token_hash = $1', [
    hashToken(token),
  ])
    .then((r) => {
      if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
      }
      req.user = { ...r.rows[0], lastSeenAt: r.rows[0].last_seen_at };
      next();
    })
    .catch((err) => {
      console.error('[auth]', err.message);
      res.status(500).json({ error: 'Erreur serveur.' });
    });
}

/** Utilisateur public (sécurité : pas d'email, pas de jeton). */
export function publicUser(row, online = false) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    lastSeenAt: row.last_seen_at,
    online,
  };
}
