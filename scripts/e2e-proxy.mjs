/**
 * E2E « vue navigateur » : tout passe par le proxy Vite (port 5173),
 * comme le ferait le vrai client web.
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:5173';
let failures = 0;
const assert = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) failures++; };

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'alice@demo.dev', password: 'demo1234' }),
});
const cookie = (loginRes.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
assert(loginRes.status === 200 && cookie.includes('token='), 'login alice via proxy');

const me = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie } })).json();
assert(me.user?.username === 'alice', 'me via proxy');

const convs = await (await fetch(`${BASE}/api/conversations`, { headers: { cookie } })).json();
assert(convs.conversations?.length >= 2, `liste de conversations (${convs.conversations?.length}) via proxy`);
const bobConv = convs.conversations.find((c) => c.peer.username === 'bob');
assert(!!bobConv?.lastMessage, 'dernier message de la conversation avec bob');

// Socket authentifié via le proxy, transport websocket uniquement (comme le client).
const s = io(BASE, { transports: ['websocket'], extraHeaders: { cookie } });
const connected = await new Promise((res) => {
  const t = setTimeout(() => res(false), 6000);
  s.once('connect', () => { clearTimeout(t); res(true); });
  s.once('connect_error', () => { clearTimeout(t); res(false); });
});
assert(connected, 'connexion WebSocket via proxy (auth cookie)');

// Présence : bob devrait apparaître hors ligne (seed) — on vérifie juste la forme.
const s2 = io(BASE, { transports: ['websocket'], extraHeaders: { cookie } }); // une 2e session d'alice
// (on se contente d'envoyer un message pour valider la chaîne complète via le proxy)
const ack = await new Promise((res) => {
  const t = setTimeout(() => res(null), 6000);
  s.emit('message:send', { conversationId: bobConv.id, body: 'Test E2E via proxy ✓', tempId: 'e2e' }, (r) => { clearTimeout(t); res(r); });
});
assert(ack?.ok && ack.message?.body === 'Test E2E via proxy ✓', 'envoi de message via proxy (ack)');

const hist = await (await fetch(`${BASE}/api/conversations/${bobConv.id}/messages?limit=3`, { headers: { cookie } })).json();
assert(hist.messages?.at(-1)?.body === 'Test E2E via proxy ✓', 'nouveau message visible dans l’historique');

s.close(); s2.close();
console.log(failures === 0 ? '\n✓ E2E via proxy : tout fonctionne.' : `\n✗ ${failures} échec(s) E2E.`);
process.exit(failures ? 1 : 0);
