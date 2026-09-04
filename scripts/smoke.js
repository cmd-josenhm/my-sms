/**
 * Test de fumée : vérifie l'API + le temps réel de bout en bout.
 *   node scripts/smoke.js   (serveur démarré sur http://localhost:4000)
 */
import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures += 1; }
}

function cookieOf(res) {
  const sc = res.headers.getSetCookie?.() || [];
  return sc.map((c) => c.split(';')[0]).join('; ');
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: cookieOf(res) };
}

function socketWith(cookie) {
  return io(BASE, { transports: ['websocket'], extraHeaders: { cookie } });
}

function once(sock, event, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout sur ${event}`)), ms);
    sock.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });
}

function emitAck(sock, event, payload) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5000);
    sock.emit(event, payload, (res) => { clearTimeout(t); resolve(res); });
  });
}

const stamp = Date.now().toString(36);
const results = {};

console.log('— Authentification —');
{
  const r1 = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `t1_${stamp}@test.dev`, password: 'password123', username: `t1_${stamp}`, displayName: 'Test Un' },
  });
  assert(r1.status === 201 && r1.data.user, 'inscription user 1 (201)');
  results.u1 = r1.cookie; results.id1 = r1.data.user?.id;

  const r2 = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `t2_${stamp}@test.dev`, password: 'password123', username: `t2_${stamp}`, displayName: 'Test Deux' },
  });
  assert(r2.status === 201, 'inscription user 2 (201)');
  results.u2 = r2.cookie; results.id2 = r2.data.user?.id;

  const bad = await api('/api/auth/login', { method: 'POST', body: { email: `t1_${stamp}@test.dev`, password: 'wrongpass1' } });
  assert(bad.status === 401, 'login avec mauvais mot de passe → 401');

  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `t1_${stamp}@test.dev`, password: 'password123', username: `dup_${stamp}`, displayName: 'Dupliqué' },
  });
  assert(dup.status === 409, 'e-mail en double → 409');

  const me = await api('/api/auth/me', { cookie: results.u1 });
  assert(me.status === 200 && me.data.user?.username === `t1_${stamp}`, 'GET /me');
}

console.log('— Recherche & conversations —');
{
  const search = await api(`/api/users/search?q=t2_${stamp}`, { cookie: results.u1 });
  assert(search.status === 200 && search.data.users?.length >= 1, 'recherche utilisateur');

  const conv = await api('/api/conversations', { method: 'POST', body: { userId: results.id2 }, cookie: results.u1 });
  assert(conv.status === 201, 'création conversation (201)');
  results.conv = conv.data.conversation;

  const convAgain = await api('/api/conversations', { method: 'POST', body: { userId: results.id2 }, cookie: results.u1 });
  assert(convAgain.data.conversation?.id === results.conv.id, 'conversation idempotente (même id)');
}

console.log('— Temps réel —');
{
  const s1 = socketWith(results.u1);
  const s2 = socketWith(results.u2);
  await Promise.all([
    new Promise((r) => s1.on('connect', r)),
    new Promise((r) => s2.on('connect', r)),
  ]);

  const pres = await once(s1, 'presence').catch(() => null);
  assert(pres?.userId === results.id2 && pres?.online === true, 'présence : user 2 signalé en ligne');

  const incoming = once(s2, 'message:new');
  const ack = await emitAck(s1, 'message:send', {
    conversationId: results.conv.id,
    body: 'Hello temps réel 🚀',
    tempId: 'tmp-1',
  });
  assert(ack?.ok && ack.message?.id, 'envoi avec ack serveur');
  const got = await incoming.catch(() => null);
  assert(got?.message?.body === 'Hello temps réel 🚀', 'réception du message chez l’interlocuteur');

  const listBefore = await api('/api/conversations', { cookie: results.u2 });
  const c1 = listBefore.data.conversations?.find((x) => x.id === results.conv.id);
  assert(c1 && c1.lastMessage?.body === 'Hello temps réel 🚀', 'dernier message visible dans la liste');
  assert(c1.unread === 1, 'compteur de non-lus = 1 avant lecture');

  const readEvt = once(s1, 'messages:read');
  await emitAck(s2, 'conversation:read', { conversationId: results.conv.id, messageId: got.message.id });
  const read = await readEvt.catch(() => null);
  assert(read?.readerId === results.id2 && !!read?.readAt, 'accusé de lecture transmis');

  const listAfter = await api('/api/conversations', { cookie: results.u2 });
  const c2 = listAfter.data.conversations?.find((x) => x.id === results.conv.id);
  assert(c2.unread === 0, 'compteur de non-lus remis à 0 après lecture');

  const hist = await api(`/api/conversations/${results.conv.id}/messages`, { cookie: results.u1 });
  assert(hist.status === 200 && hist.data.messages?.length === 1, 'historique paginé');

  // Throttle anti-spam
  let throttled = false;
  for (let i = 0; i < 35; i++) {
    const a = await emitAck(s1, 'message:send', { conversationId: results.conv.id, body: 'spam' });
    if (a && a.error === 'slow') { throttled = true; break; }
  }
  assert(throttled, 'throttle anti-spam des messages');

  s1.close(); s2.close();
}

console.log(failures === 0 ? '\n✓ Tous les tests de fumée passent.' : `\n✗ ${failures} test(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
