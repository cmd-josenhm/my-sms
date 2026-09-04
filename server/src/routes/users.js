import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { isPositiveInt } from '../util/validate.js';
import { onlineSet } from '../presence.js';

const router = Router();

router.use(requireAuth);

// GET /api/users/search?q=ab — recherche d'utilisateurs (min 1 caractère)
router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 1 || q.length > 60) return res.json({ users: [] });
  const esc = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const r = await query(
    `SELECT id, username, display_name, avatar_color, last_seen_at
     FROM users
     WHERE id <> $1
       AND (username ILIKE $2 ESCAPE '\\' OR display_name ILIKE $2 ESCAPE '\\' OR email ILIKE $2 ESCAPE '\\')
     ORDER BY username
     LIMIT 20`,
    [req.user.id, `%${esc}%`]
  );
  res.json({ users: r.rows.map((u) => publicUser(u, onlineSet.has(u.id))) });
});

// GET /api/users/:id — profil public
router.get('/:id', async (req, res) => {
  if (!isPositiveInt(Number(req.params.id))) return res.status(400).json({ error: 'Identifiant invalide.' });
  const r = await query(
    'SELECT id, username, display_name, avatar_color, last_seen_at FROM users WHERE id = $1',
    [Number(req.params.id)]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  res.json({ user: publicUser(r.rows[0], onlineSet.has(r.rows[0].id)) });
});

export default router;
