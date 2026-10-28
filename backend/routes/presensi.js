const express = require('express');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

const STATUS_VALID = ['hadir', 'izin', 'sakit', 'alpa'];

// Lihat presensi. RLS menyaring: mahasiswa hanya miliknya,
// dosen hanya mata kuliah yang dia ampu, admin melihat semua.
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('presensi')
    .select(
      'id, pertemuan_ke, tanggal, status, krs:krs_id (id, semester, mahasiswa:mahasiswa_id (nama, nim_nip), mata_kuliah:mata_kuliah_id (kode, nama))'
    )
    .order('pertemuan_ke');
  if (error) return res.status(500).json({ pesan: error.message });
  res.json(data);
});

// Dosen mencatat kehadiran
router.post('/', async (req, res) => {
  const { krs_id, pertemuan_ke, status, tanggal } = req.body;
  const pertemuan = Number(pertemuan_ke);

  if (!krs_id || !Number.isInteger(pertemuan) || pertemuan < 1 || pertemuan > 16) {
    return res.status(400).json({ pesan: 'krs_id wajib diisi dan pertemuan_ke harus 1-16' });
  }
  if (!STATUS_VALID.includes(status)) {
    return res.status(400).json({ pesan: 'status harus: hadir, izin, sakit, atau alpa' });
  }

  const baris = { krs_id, pertemuan_ke: pertemuan, status };
  if (tanggal) baris.tanggal = tanggal;

  const { data, error } = await req.db.from('presensi').insert(baris).select().single();

  if (error) {
    if (error.code === '42501') {
      return res.status(403).json({ pesan: 'Hanya dosen pengampu yang boleh mencatat presensi' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ pesan: 'Presensi pertemuan ini sudah tercatat, gunakan PUT untuk mengubahnya' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ pesan: 'KRS tidak ditemukan' });
    }
    return res.status(400).json({ pesan: error.message });
  }
  res.status(201).json(data);
});

// Dosen mengubah status kehadiran
router.put('/:id', async (req, res) => {
  const { status } = req.body;
  if (!STATUS_VALID.includes(status)) {
    return res.status(400).json({ pesan: 'status harus: hadir, izin, sakit, atau alpa' });
  }

  const { data, error } = await req.db
    .from('presensi')
    .update({ status })
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(400).json({ pesan: error.message });
  if (data.length === 0) {
    return res.status(404).json({ pesan: 'Presensi tidak ditemukan atau kamu bukan dosen pengampu' });
  }
  res.json(data[0]);
});

module.exports = router;