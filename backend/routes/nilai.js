const express = require('express');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

// Konversi angka ke huruf (skala asumsi, sesuaikan kalau dosenmu punya skala lain)
function keHuruf(n) {
  if (n >= 85) return 'A';
  if (n >= 70) return 'B';
  if (n >= 55) return 'C';
  if (n >= 40) return 'D';
  return 'E';
}

function ambilAngka(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

// Lihat nilai. RLS menyaring: mahasiswa hanya nilainya sendiri,
// dosen hanya mata kuliah yang dia ampu, admin melihat semua.
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('nilai')
    .select(
      'id, nilai_angka, nilai_huruf, krs:krs_id (id, semester, mahasiswa:mahasiswa_id (nama, nim_nip), mata_kuliah:mata_kuliah_id (kode, nama, sks))'
    )
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ pesan: error.message });
  res.json(data);
});

// Dosen menginput nilai
router.post('/', async (req, res) => {
  const { krs_id } = req.body;
  const angka = ambilAngka(req.body.nilai_angka);
  if (!krs_id || angka === null) {
    return res.status(400).json({ pesan: 'krs_id wajib diisi dan nilai_angka harus 0-100' });
  }

  const { data, error } = await req.db
    .from('nilai')
    .insert({ krs_id, nilai_angka: angka, nilai_huruf: keHuruf(angka) })
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      return res.status(403).json({ pesan: 'Hanya dosen pengampu yang boleh menginput nilai' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ pesan: 'Nilai sudah ada, gunakan PUT untuk mengubahnya' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ pesan: 'KRS tidak ditemukan' });
    }
    return res.status(400).json({ pesan: error.message });
  }
  res.status(201).json(data);
});

// Dosen mengubah nilai
router.put('/:id', async (req, res) => {
  const angka = ambilAngka(req.body.nilai_angka);
  if (angka === null) {
    return res.status(400).json({ pesan: 'nilai_angka harus 0-100' });
  }

  const { data, error } = await req.db
    .from('nilai')
    .update({ nilai_angka: angka, nilai_huruf: keHuruf(angka) })
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(400).json({ pesan: error.message });
  if (data.length === 0) {
    return res.status(404).json({ pesan: 'Nilai tidak ditemukan atau kamu bukan dosen pengampu' });
  }
  res.json(data[0]);
});

module.exports = router;