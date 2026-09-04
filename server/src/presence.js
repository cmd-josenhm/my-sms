/**
 * Présence en mémoire (utilisateurs actuellement connectés).
 * En mode multi-instance, cet état serait partagé via Redis (pub/sub Socket.IO).
 */
export const onlineSet = new Set();

export function markOnline(userId) {
  onlineSet.add(userId);
}

export function markOffline(userId) {
  onlineSet.delete(userId);
}
