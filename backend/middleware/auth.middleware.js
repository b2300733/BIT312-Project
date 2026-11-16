const jwt = require('jsonwebtoken');

const getJwtSecret = () => process.env.JWT_SECRET;

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.auth_token || null;
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token.' });
  }

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ message: 'JWT_SECRET is not configured.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = {
      _id: payload._id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      department: payload.department,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user?.role || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
};
