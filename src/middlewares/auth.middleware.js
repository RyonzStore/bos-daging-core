import jwt from 'jsonwebtoken';

export function requireOwnerAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token autentikasi tidak ditemukan' });
  try {
    req.owner = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
}
