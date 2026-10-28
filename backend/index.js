require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');
const { supabaseUntukToken } = require('./supabase');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env_terbaca: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
});

app.get('/api/tes-supabase', async (req, res) => {
  const { data, error } = await supabase.from('mata_kuliah').select('*');
  if (error) {
    return res.status(500).json({ terhubung: false, pesan: error.message });
  }
  res.json({ terhubung: true, jumlah_terbaca: data.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ pesan: 'Email dan password wajib diisi' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ pesan: 'Email atau password salah' });
  }

  const token = data.session.access_token;
  const db = supabaseUntukToken(token);
  const { data: profile, error: errProfil } = await db
    .from('profiles')
    .select('nama, role, nim_nip')
    .eq('id', data.user.id)
    .single();

  if (errProfil) {
    return res.status(403).json({ pesan: 'Akun belum punya profil' });
  }

  res.json({ token, profile });
});