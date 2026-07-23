const jwt = require('jsonwebtoken');

function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'mamina_sprint1_secret_change_me');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

module.exports = { authAdmin };
