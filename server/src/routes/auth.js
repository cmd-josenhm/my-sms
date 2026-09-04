import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  issueSession,
  clearAuthCookie,
  requireAuth,
  publicUser,
  avatarColorFor,
} from '../auth.js';
import {
  isValidEmail,
  isStrongPassword,
  isValidUsername,
  cleanDisplayName,
} from '../util/validate.js';
import { makeRateLimiter } from '../util/ratelimit.js';

// Hash calculé une fois au démarrage : même coût de calcul qu'une vraie
// vérification, pour égaliser les temps de réponse (anti-enchaînements).
const DUMMY_HASH = bcrypt.hashSync('my-sms-timing-padding', 12);

const authLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  name: 'authentification',
});

const router = Router();

// POST /api/auth/register — création de compte + session
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, username, displayName } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  if (!isStrongPassword(password)) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  if (!isValidUsername(username)) return res.status(400).json({ error: 'Nom d’utilisateur invalide (3 à 20 caractères : lettres, chiffres, _).' });
  const name = cleanDisplayName(displayName);
  if (!name) return res.status(400).json({ error: 'Nom d’affichage invalide (2 à 50 caractères).' });

  const emailNorm = email.trim().toLowerCase();
  try {
    const user = await withTransaction(async (client) => {
      const r = await client.query(
        `INSERT INTO users (email, username, password_hash, display_name)
         VALUES ($1, lower($2), $3, $4)
         RETURNING id`,
        [emailNorm, username, await hashPassword(password), name]
      );
      const id = r.rows[0].id;
      const color = avatarColorFor(id);
      await client.query('UPDATE users SET avatar_color = $1 WHERE id = $2', [color, id]);
      const u = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      return u.rows[0];
    });

    await issueSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      const onEmail = err.constraint === 'users_email_key';
      return res.status(409).json({
        error: onEmail
          ? 'Un compte existe déjà avec cet e-mail.'
          : 'Ce nom d’utilisateur est déjà pris.',
      });
    }
    console.error('[register]', err);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'E-mail ou mot de passe manquant.' });
  }
  const r = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  const user = r.rows[0];
  // Comparaison toujours exécutée (même coût) pour limiter le timing attack.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });

  await issueSession(res, user.id);
  res.json({ user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await query('UPDATE users SET auth_token_hash = NULL WHERE id = $1', [req.user.id]);
  clearAuthCookie(res);
  res.json({ ok: true });
});

// POST /api/auth/password — changement de mot de passe (session requise)
router.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'Mot de passe invalide (8 caractères minimum).' });
  }
  const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await verifyPassword(currentPassword, r.rows[0].password_hash))) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    await hashPassword(newPassword),
    req.user.id,
  ]);
  res.json({ ok: true });
});

export default router;
