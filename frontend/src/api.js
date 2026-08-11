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

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      API_BASE
        ? 'Respuesta inválida del API'
        : 'No se pudo hablar con el API. Configura VITE_API_URL con la URL del backend en Railway (variable de build) y vuelve a desplegar el frontend.'
    );
  }

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
  getActiveOrder: (sessionToken) =>
    request(`/api/orders/active?sessionToken=${encodeURIComponent(sessionToken)}`),
  getKitchenOrders: () => request('/api/kitchen'),
  getKitchenOrder: (id) => request(`/api/kitchen/${id}`),
  // se añadio el status
  updateKitchenOrderStatus: (id, status) =>
    request(`/api/kitchen/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
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
  getAdminTables: () => request('/api/admin/tables'),
  createAdminTable: (payload) =>
    request('/api/admin/tables', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminTable: (id, payload) =>
    request(`/api/admin/tables/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  setAdminTableActive: (id, isActive) =>
    request(`/api/admin/tables/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  deleteAdminTable: (id) => request(`/api/admin/tables/${id}`, { method: 'DELETE' }),
  getAdminOrders: () => request('/api/admin/orders'),
  getAdminOrder: (id) => request(`/api/admin/orders/${id}`),
  cancelAdminOrder: (id) =>
    request(`/api/admin/orders/${id}/cancel`, { method: 'POST' }),
  getAdminStats: () => request('/api/admin/stats'),
  getAdminStatsOrders: (from, to) =>
    request(`/api/admin/stats/orders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  closeAdminOrderSession: (id) =>
    request(`/api/admin/orders/${id}/close-session`, { method: 'POST' }),
  updateOrderNotes: (id, notes) =>
    request(`/api/admin/orders/${id}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),
  addOrderItem: (id, payload) =>
    request(`/api/admin/orders/${id}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrderItem: (orderId, itemId, payload) =>
    request(`/api/admin/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  removeOrderItem: (orderId, itemId) =>
    request(`/api/admin/orders/${orderId}/items/${itemId}`, { method: 'DELETE' }),
  requestFinishOrder: (sessionToken) =>
    request('/api/orders/request-finish', {
      method: 'POST',
      body: JSON.stringify({ sessionToken }),
    }),
  getFloorTables: () => request('/api/admin/floor/tables'),
  openFloorTable: (id) =>
    request(`/api/admin/floor/tables/${id}/open`, { method: 'POST' }),
  openFloorTakeaway: () => request('/api/admin/floor/takeaway', { method: 'POST' }),
  getStaffAlerts: () => request('/api/admin/alerts'),
  attendStaffAlert: (id) =>
    request(`/api/admin/alerts/${id}/attend`, { method: 'POST' }),
  staffAlertsStreamUrl: () => {
    try {
      const raw = localStorage.getItem('mamina_admin');
      const token = raw ? JSON.parse(raw)?.token : '';
      return `${API_BASE}/api/admin/alerts/stream?token=${encodeURIComponent(token || '')}`;
    } catch {
      return `${API_BASE}/api/admin/alerts/stream`;
    }
  },
};
