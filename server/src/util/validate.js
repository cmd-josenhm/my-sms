const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim()) && v.length <= 254;
}

export function isStrongPassword(v) {
  return typeof v === 'string' && v.length >= 8 && v.length <= 72;
}

export function isValidUsername(v) {
  return typeof v === 'string' && USERNAME_RE.test(v);
}

export function cleanDisplayName(v) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 50 ? s : null;
}

export function cleanMessage(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= 2000 ? s : null;
}

export function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}
