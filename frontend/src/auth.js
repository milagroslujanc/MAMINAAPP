const STAFF_KEYS = {
  admin: 'admin_token',
  cocina: 'cocina_token',
  mesero: 'mesero_token',
};

function keyForRole(role) {
  return STAFF_KEYS[role] || null;
}

export function getStaffSession(role) {
  try {
    const key = keyForRole(role);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStaffSession(data) {
  const role = data?.admin?.role;
  const key = keyForRole(role);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function clearStaffSession(role) {
  const key = keyForRole(role);
  if (key) localStorage.removeItem(key);
}

export function getStaffRole() {
  return Object.keys(STAFF_KEYS).find((role) => getStaffSession(role)) || null;
}

export function homeForRole(role) {
  if (role === 'mesero') return '/mesero/mesas';
  if (role === 'admin') return '/admin/panel';
  if (role === 'cocina') return '/cocina/pedidos';
  return '/admin';
}
