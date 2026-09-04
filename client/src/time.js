const DAY_MS = 86_400_000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (isSameDay(d, now)) return "Aujourd'hui";
  if (isSameDay(d, new Date(now.getTime() - DAY_MS))) return 'Hier';
  const opts = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('fr-FR', opts);
}

export function formatListTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (isSameDay(d, now)) return formatTime(ts);
  if (isSameDay(d, new Date(now.getTime() - DAY_MS))) return 'Hier';
  if (now - d < 6 * DAY_MS) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatLastSeen(peer) {
  if (peer?.online) return 'en ligne';
  const ts = peer?.lastSeenAt;
  if (!ts) return 'hors ligne';
  const d = new Date(ts);
  const now = new Date();
  if (now - d < 60_000) return 'vu à l’instant';
  if (isSameDay(d, now)) return `vu à ${formatTime(ts)}`;
  if (isSameDay(d, new Date(now.getTime() - DAY_MS))) return `vu hier à ${formatTime(ts)}`;
  return `vu le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
