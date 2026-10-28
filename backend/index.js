require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');

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