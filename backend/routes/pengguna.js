const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

// Klien khusus admin (kunci SECRET). Hanya dipakai untuk membuat/menghapus akun login.
// Kunci ini tidak boleh keluar dari server: jangan kirim ke frontend, jangan di-commit.
const adminAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Akun admin dibuat manual lewat dashboard Supabase, bukan dari aplikasi.
const PERAN_BOLEH = ['dosen', 'mahasiswa'];

// Satpam kedua: hanya admin yang boleh lewat. Perannya dibaca dari database.
async function wajibAdmin(req, res, next) {
  const { data, error } = await req.db
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();
  if (error || !data || data.role !== 'admin') {
    return res.status(403).json({ pesan: 'Hanya admin yang boleh mengelola pengguna' });
  }
  next();
}
router.use(wajibAdmin);

// Daftar semua pengguna
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('profiles')
    .select('id, nama, role, nim_nip')
    .order('role')
    .order('nama');
  if (error) return res.status(500).json({ pesan: error.message });
  res.json(data);
});

// Tambah akun dosen atau mahasiswa
router.post('/', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nama = String(req.body.nama || '').trim();
  const role = req.body.role;
  const nimNip = String(req.body.nim_nip || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ pesan: 'Format email tidak valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ pesan: 'Password minimal 8 karakter' });
  }
  if (!nama) {
    return res.status(400).json({ pesan: 'Nama wajib diisi' });
  }
  if (!PERAN_BOLEH.includes(role)) {
    return res.status(400).json({ pesan: 'Peran harus dosen atau mahasiswa' });
  }
  if (!nimNip) {
    return res.status(400).json({ pesan: 'NIM/NIP wajib diisi' });
  }

  // Langkah 1: buat akun login
  const { data: akun, error: errAkun } = await adminAuth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errAkun) {
    if (errAkun.code === 'email_exists' || /already/i.test(errAkun.message)) {
      return res.status(409).json({ pesan: 'Email sudah terdaftar' });
    }
    return res.status(400).json({ pesan: errAkun.message });
  }

  // Langkah 2: buat profil (peran). RLS tetap berlaku: hanya admin yang boleh insert.
  const { data: profil, error: errProfil } = await req.db
    .from('profiles')
    .insert({ id: akun.user.id, nama, role, nim_nip: nimNip })
    .select('id, nama, role, nim_nip')
    .single();

  if (errProfil) {
    // Kalau profil gagal dibuat, akun login yang tadi dibuat ikut dibatalkan
    await adminAuth.auth.admin.deleteUser(akun.user.id);
    if (errProfil.code === '23505') {
      return res.status(409).json({ pesan: 'NIM/NIP sudah dipakai pengguna lain' });
    }
    return res.status(400).json({ pesan: errProfil.message });
  }

  res.status(201).json(profil);
});

module.exports = router;