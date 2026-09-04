import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './db.js';
import { avatarColorFor } from './auth.js';

const PASSWORD = 'demo1234';

const users = [
  { email: 'alice@demo.dev', username: 'alice', displayName: 'Alice Martin' },
  { email: 'bob@demo.dev', username: 'bob', displayName: 'Bob Dubois' },
  { email: 'chloe@demo.dev', username: 'chloe', displayName: 'Chloé Petit' },
];

const daysAgo = (d, h = 12, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, m, 0, 0);
  return dt;
};

try {
  const existing = await pool.query('SELECT count(*)::int AS n FROM users');
  if (existing.rows[0].n > 0) {
    console.log('✓ Base déjà peuplée, seed ignoré.');
    process.exit(0);
  }

  await withTransaction(async (client) => {
    const hash = await bcrypt.hash(PASSWORD, 12);
    const ids = {};
    for (const u of users) {
      const r = await client.query(
        'INSERT INTO users (email, username, password_hash, display_name, last_seen_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [u.email, u.username, hash, u.displayName, daysAgo(0, 9, 15)]
      );
      ids[u.username] = r.rows[0].id;
      await client.query('UPDATE users SET avatar_color = $1 WHERE id = $2', [
        avatarColorFor(r.rows[0].id),
        r.rows[0].id,
      ]);
    }

    const convs = {};
    const openConv = async (a, b) => {
      const r = await client.query(
        `INSERT INTO conversations (user_a, user_b)
         SELECT least($1::bigint, $2::bigint), greatest($1::bigint, $2::bigint)
         ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = excluded.user_a
         RETURNING id`,
        [a, b]
      );
      const id = r.rows[0].id;
      await client.query(
        'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING',
        [id, a, b]
      );
      convs[`${a}-${b}`] = id;
      return id;
    };

    const addMsg = async (convId, sender, body, at) => {
      await client.query(
        'INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES ($1, $2, $3, $4)',
        [convId, sender, body, at]
      );
    };

    // --- alice ↔ bob ---
    const ab = await openConv(ids.alice, ids.bob);
    await addMsg(ab, ids.bob, 'Salut Alice ! Tu as vu le match hier soir ? ⚽', daysAgo(2, 18, 4));
    await addMsg(ab, ids.alice, 'Oui !!! Incroyable ce match 😄', daysAgo(2, 18, 7));
    await addMsg(ab, ids.bob, 'On se refait un tour au cinéma ce week-end ?', daysAgo(2, 18, 9));
    await addMsg(ab, ids.alice, 'Bien sûr, samedi matin comme d’habitude 🍿', daysAgo(2, 18, 12));
    await addMsg(ab, ids.bob, 'Parfait, 11h au cinéma du centre ?', daysAgo(1, 9, 30));
    await addMsg(ab, ids.alice, 'Ça marche ! Je t’envoie les liens pour réserver 🎬', daysAgo(1, 9, 41));
    await addMsg(ab, ids.bob, 'T’es une légende. Merci !', daysAgo(0, 8, 12));

    // --- alice ↔ chloe ---
    const ac = await openConv(ids.alice, ids.chloe);
    await addMsg(ac, ids.chloe, 'Coucou ! Tu passes par Cotonou cette semaine ?', daysAgo(3, 10, 5));
    await addMsg(ac, ids.alice, 'Oui, je passe te voir mardi vers 17h promis 🙌', daysAgo(3, 10, 20));
    await addMsg(ac, ids.chloe, 'Super !! Je prépare le gâteau au chocolat 🍫', daysAgo(3, 10, 22));
    await addMsg(ac, ids.chloe, 'N’oublie pas de me prévenir avant d’arriver 😉', daysAgo(0, 9, 50));
  });

  console.log('✓ Données de démo créées :');
  console.log('    alice@demo.dev / demo1234');
  console.log('    bob@demo.dev   / demo1234');
  console.log('    chloe@demo.dev / demo1234');
  process.exit(0);
} catch (err) {
  console.error('✗ Seed en échec :', err.message);
  process.exit(1);
}
