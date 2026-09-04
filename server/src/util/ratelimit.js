/**
 * Rate limiter en mémoire (par clé — IP, socket…).
 * Suffisant pour une instance ; avec plusieurs instances, passer derrière
 * un rate limit Redis (ou utiliser le REDIS_URL déjà prévu pour Socket.IO).
 */
export function makeRateLimiter({ windowMs, max, name = 'rate-limit' }) {
  const hits = new Map();

  // Purge périodique des entrées expirées.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, windowMs);
  timer.unref?.();

  function check(key) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= max;
  }

  return function rateLimit(req, res, next) {
    const key = req.ip || 'unknown';
    if (!check(key)) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: `Trop de requêtes (${name}), attends un instant.` });
    }
    next();
  };
}

/** Throttle par paires (socket, conversation) pour les événements temps réel. */
export function makeThrottle({ windowMs, max }) {
  const buckets = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }, windowMs);
  timer.unref?.();

  return (key) => {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    return b.count <= max;
  };
}
