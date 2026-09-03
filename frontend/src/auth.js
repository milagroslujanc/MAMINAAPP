const STAFF_KEY = 'mamina_admin';

export function getStaffSession() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStaffSession(data) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(data));
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_KEY);
}

export function getStaffRole() {
  return getStaffSession()?.admin?.role || null;
}

export function homeForRole(role) {
  if (role === 'mesero') return '/mesero/mesas';
  if (role === 'admin') return '/admin/panel';
  if (role === 'cocina') return '/cocina/pedidos';
  return '/admin';
}
