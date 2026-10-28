const { supabaseUntukToken } = require('../supabase');

async function wajibLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ pesan: 'Belum login' });
  }

  const db = supabaseUntukToken(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ pesan: 'Token tidak valid atau kedaluwarsa' });
  }

  req.db = db;
  req.user = data.user;
  next();
}

module.exports = { wajibLogin };