export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Connexion au serveur impossible.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Erreur inattendue.', res.status);
  return data;
}

export const api = {
  me: () => request('/api/auth/me').then((d) => d.user),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }).then((d) => d.user),
  register: (form) =>
    request('/api/auth/register', { method: 'POST', body: form }).then((d) => d.user),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  searchUsers: (q) =>
    request(`/api/users/search?q=${encodeURIComponent(q)}`).then((d) => d.users),
  conversations: () => request('/api/conversations').then((d) => d.conversations),
  openConversation: (userId) =>
    request('/api/conversations', { method: 'POST', body: { userId } }).then((d) => d.conversation),
  messages: (convId, before, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', String(before));
    return request(`/api/conversations/${convId}/messages?${params}`);
  },
};
