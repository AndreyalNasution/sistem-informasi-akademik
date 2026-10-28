const express = require('express');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

// Lihat KRS. RLS yang menyaring: mahasiswa hanya melihat miliknya,
// dosen hanya KRS di mata kuliah yang dia ampu, admin melihat semua.
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('krs')
    .select('id, semester, mahasiswa_id, mata_kuliah:mata_kuliah_id (id, kode, nama, sks)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ pesan: error.message });
  res.json(data);
});

// Mahasiswa mengambil mata kuliah
router.post('/', async (req, res) => {
  const { mata_kuliah_id, semester } = req.body;
  if (!mata_kuliah_id || !semester) {
    return res.status(400).json({ pesan: 'mata_kuliah_id dan semester wajib diisi' });
  }

  const { data, error } = await req.db
    .from('krs')
    .insert({ mahasiswa_id: req.user.id, mata_kuliah_id, semester })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      return res.status(403).json({ pesan: 'Hanya mahasiswa yang boleh mengisi KRS' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ pesan: 'Mata kuliah ini sudah ada di KRS-mu' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ pesan: 'Mata kuliah tidak ditemukan' });
    }
    return res.status(400).json({ pesan: error.message });
  }
  res.status(201).json(data);
});

// Batalkan KRS
router.delete('/:id', async (req, res) => {
  const { data, error } = await req.db
    .from('krs')
    .delete()
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(400).json({ pesan: error.message });
  if (data.length === 0) {
    return res.status(404).json({ pesan: 'KRS tidak ditemukan atau bukan milikmu' });
  }
  res.json({ pesan: 'KRS dibatalkan' });
});

module.exports = router;