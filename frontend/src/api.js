const API_BASE = import.meta.env.VITE_API_URL || '';

function authHeaders() {
  try {
    const raw = localStorage.getItem('mamina_admin');
    if (!raw) return {};
    const { token } = JSON.parse(raw);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Error de red');
  }
  return data;
}

export const api = {
  getTables: () => request('/api/tables'),
  selectTable: (id) => request(`/api/tables/${id}/select`, { method: 'POST' }),
  takeaway: () => request('/api/tables/takeaway', { method: 'POST' }),
  releaseTable: (id) => request(`/api/tables/${id}/release`, { method: 'POST' }),
  resolveSession: (token) => request(`/api/sessions/${token}`),
  getMenu: () => request('/api/menu'),
  createOrder: (payload) =>
    request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getKitchenOrders: () => request('/api/kitchen'),
  getKitchenOrder: (id) => request(`/api/kitchen/${id}`),
  kitchenStreamUrl: () => `${API_BASE}/api/kitchen/stream`,
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/api/auth/me'),
  getAdminCategories: () => request('/api/admin/categories'),
  getAdminProducts: () => request('/api/admin/products'),
  createAdminProduct: (payload) =>
    request('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminProduct: (id, payload) =>
    request(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  setAdminProductActive: (id, isActive) =>
    request(`/api/admin/products/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  deleteAdminProduct: (id) => request(`/api/admin/products/${id}`, { method: 'DELETE' }),
};
