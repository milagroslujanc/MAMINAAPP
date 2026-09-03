const jwt = require('jsonwebtoken');

function normalizeRole(payload) {
  if (payload?.role === 'admin' || payload?.role === 'mesero' || payload?.role === 'cocina') {
    return payload.role;
  }
  if (payload?.username === 'mesero') return 'mesero';
  if (payload?.username === 'cocina') return 'cocina';
  return 'admin';
}

function authStaff(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me');
    const role = normalizeRole(payload);
    req.admin = { ...payload, role };
    req.staff = { ...payload, role };
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

/** Solo administrador (acceso total) */
function requireAdmin(req, res, next) {
  authStaff(req, res, () => {
    if (req.staff?.role !== 'admin') {
      return res.status(403).json({
        message: 'Solo el administrador puede acceder a esta sección',
      });
    }
    next();
  });
}

/** Admin o mesero (gestión de pedidos) */
function requireStaff(req, res, next) {
  authStaff(req, res, () => {
    if (!['admin', 'mesero'].includes(req.staff?.role)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
  });
}

/** Cocina o administrador */
function requireKitchen(req, res, next) {
  authStaff(req, res, () => {
    if (!['admin', 'cocina'].includes(req.staff?.role)) {
      return res.status(403).json({ message: 'Acceso denegado. Entra por /cocina' });
    }
    next();
  });
}

const authAdmin = requireAdmin;

module.exports = { authStaff, requireAdmin, requireStaff, requireKitchen, authAdmin, normalizeRole };
