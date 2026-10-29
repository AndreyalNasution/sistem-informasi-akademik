const express = require('express');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

// Batas SKS per semester. Angka 24 adalah asumsi umum, bukan dari PDF dosen.
// Ubah di sini kalau kampus punya aturan lain.
const BATAS_SKS = 24;

// Lihat KRS. RLS yang menyaring: mahasiswa hanya melihat miliknya,
// dosen hanya KRS di mata kuliah yang dia ampu, admin melihat semua.
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('krs')
    .select('id, semester, mahasiswa_id, mahasiswa:mahasiswa_id (nama, nim_nip), mata_kuliah:mata_kuliah_id (id, kode, nama, sks)')
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

  // Aturan 1: total SKS di semester ini tidak boleh melebihi batas
  const { data: mk, error: errMk } = await req.db
    .from('mata_kuliah')
    .select('sks')
    .eq('id', mata_kuliah_id)
    .single();
  if (errMk || !mk) {
    return res.status(400).json({ pesan: 'Mata kuliah tidak ditemukan' });
  }

  const { data: yangAda, error: errAda } = await req.db
    .from('krs')
    .select('mata_kuliah:mata_kuliah_id (sks)')
    .eq('mahasiswa_id', req.user.id)
    .eq('semester', semester);
  if (errAda) return res.status(500).json({ pesan: errAda.message });

  const sksSekarang = yangAda.reduce((jumlah, k) => jumlah + k.mata_kuliah.sks, 0);
  if (sksSekarang + mk.sks > BATAS_SKS) {
    return res.status(400).json({
      pesan: `Melebihi batas ${BATAS_SKS} SKS per semester (sudah ${sksSekarang} SKS, mata kuliah ini ${mk.sks} SKS)`,
    });
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
  // Aturan 2: KRS yang sudah punya nilai atau presensi tidak boleh dibatalkan,
  // karena menghapusnya ikut menghapus nilai dan presensi tersebut.
  const [nilai, presensi] = await Promise.all([
    req.db.from('nilai').select('id').eq('krs_id', req.params.id).limit(1),
    req.db.from('presensi').select('id').eq('krs_id', req.params.id).limit(1),
  ]);
  if (nilai.error || presensi.error) {
    return res.status(400).json({ pesan: 'ID KRS tidak valid' });
  }
  if (nilai.data.length > 0) {
    return res.status(409).json({ pesan: 'KRS tidak bisa dibatalkan karena sudah ada nilai' });
  }
  if (presensi.data.length > 0) {
    return res.status(409).json({ pesan: 'KRS tidak bisa dibatalkan karena sudah ada presensi' });
  }

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