import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { config } from './config.js';
import { pool, closePool } from './db.js';
import { setupSockets } from './sockets.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import conversationsRoutes from './routes/conversations.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '16kb' }));

// --- API ---
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'my-sms', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inexistante.' }));

// --- Application web (build Vite) en production ---
if (existsSync(config.publicDir)) {
  app.use(express.static(config.publicDir, { index: 'index.html', maxAge: '1h' }));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });
}

// Erreurs JSON (JSON malformé, inattendues…)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps de requête invalide.' });
  }
  console.error('[server]', err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

// --- HTTP + WebSocket ---
const server = http.createServer(app);
const io = new Server(server, {
  serveClient: false,
  maxHttpBufferSize: 1e5,
});

// Multi-instance : partage de la présence/événements via Redis.
if (config.redisUrl) {
  const { createClient } = await import('ioredis');
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const pub = createClient(config.redisUrl, { lazyConnect: false });
  const sub = pub.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub));
  console.log('✓ Socket.IO branché sur Redis (multi-instance).');
}

setupSockets(server, io);

// Vérifie la base au démarrage.
try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`✗ Impossible de joindre PostgreSQL : ${err.message}`);
  console.error('  (Lance `npm run dev:db` en local, ou vérifie DATABASE_URL.)');
  process.exit(1);
}

server.listen(config.port, '0.0.0.0', () => {
  console.log(`✓ my-sms API + WebSocket sur http://0.0.0.0:${config.port} (${config.env})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} reçu, arrêt propre…`);
  io.close();
  await closePool().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
