// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

function requireOwnerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.owner = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa.' });
  }
}

module.exports = { requireOwnerAuth };