/**
 * Démarre un PostgreSQL embarqué (binaires officiels fournis par le package
 * npm `embedded-postgres`) pour le développement local.
 *
 *   npm run dev:db
 *
 * Le cluster persiste dans .data/pgdata (ignoré par Git).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = process.env.PG_DATA_DIR || path.join(root, '.data', 'pgdata');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PG_PORT || 5433);
const READY_MARKER = path.join(root, '.data', 'pg-ready');

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, HOST);
    s.setTimeout(800);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

if (await portOpen(PORT)) {
  console.log(`✓ PostgreSQL déjà démarré sur le port ${PORT}.`);
  process.exit(0);
}

const { default: EmbeddedPostgres } = await import('embedded-postgres');
mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'mysms',
  password: 'mysms',
  port: PORT,
  persistent: true,
});

const firstBoot = !existsSync(path.join(dataDir, 'PG_VERSION'));
if (firstBoot) {
  console.log('… première initialisation du cluster PostgreSQL');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('mysms');
  writeFileSync(READY_MARKER, 'ok');
  console.log('✓ Cluster initialisé.');
} else {
  await pg.start();
}

console.log(`✓ PostgreSQL de développement prêt : postgres://mysms:mysms@localhost:${PORT}/mysms`);

// Garde le processus en vie (processus de dev au premier plan).
process.stdin.resume();
process.on('SIGINT', async () => { await pg.stop().catch(() => {}); process.exit(0); });
process.on('SIGTERM', async () => { await pg.stop().catch(() => {}); process.exit(0); });
