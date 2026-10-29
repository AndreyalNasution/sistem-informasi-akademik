const express = require('express');
const { wajibLogin } = require('../middleware/auth');

const router = express.Router();
router.use(wajibLogin);

// Membaca dan memeriksa isian mata kuliah (dipakai oleh tambah dan ubah)
function bacaInput(body) {
  const kode = String(body.kode || '').trim();
  const nama = String(body.nama || '').trim();
  const sks = Number(body.sks);
  if (!kode || !nama) return { pesan: 'kode dan nama wajib diisi' };
  if (!Number.isInteger(sks) || sks < 1 || sks > 6) {
    return { pesan: 'sks harus bilangan bulat 1 sampai 6' };
  }
  return { nilai: { kode, nama, sks, dosen_id: body.dosen_id || null } };
}

// Dosen pengampu harus akun berperan dosen (bukan mahasiswa atau admin)
async function dosenValid(db, id) {
  if (!id) return true;
  const { data, error } = await db.from('profiles').select('role').eq('id', id).single();
  return !error && Boolean(data) && data.role === 'dosen';
}

// Semua pengguna yang login boleh melihat daftar mata kuliah
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('mata_kuliah')
    .select('id, kode, nama, sks, dosen_id')
    .order('kode');
  if (error) return res.status(500).json({ pesan: error.message });
  res.json(data);
});

// Tambah (RLS: hanya admin)
router.post('/', async (req, res) => {
  const input = bacaInput(req.body);
  if (input.pesan) return res.status(400).json({ pesan: input.pesan });
  if (!(await dosenValid(req.db, input.nilai.dosen_id))) {
    return res.status(400).json({ pesan: 'Dosen pengampu harus akun berperan dosen' });
  }

  const { data, error } = await req.db
    .from('mata_kuliah')
    .insert(input.nilai)
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      return res.status(403).json({ pesan: 'Hanya admin yang boleh menambah mata kuliah' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ pesan: 'Kode mata kuliah sudah dipakai' });
    }
    return res.status(400).json({ pesan: error.message });
  }
  res.status(201).json(data);
});

// Ubah (RLS: hanya admin)
router.put('/:id', async (req, res) => {
  const input = bacaInput(req.body);
  if (input.pesan) return res.status(400).json({ pesan: input.pesan });

  const { data: lama, error: errLama } = await req.db
    .from('mata_kuliah')
    .select('id, sks')
    .eq('id', req.params.id)
    .single();
  if (errLama || !lama) {
    return res.status(404).json({ pesan: 'Mata kuliah tidak ditemukan' });
  }

  // Aturan: SKS tidak boleh berubah kalau sudah ada mahasiswa yang mengambil,
  // karena total SKS di KRS dan perhitungan IP mereka ikut berubah.
  if (lama.sks !== input.nilai.sks) {
    const { data: dipakai, error: errPakai } = await req.db
      .from('krs')
      .select('id')
      .eq('mata_kuliah_id', req.params.id)
      .limit(1);
    if (errPakai) return res.status(500).json({ pesan: errPakai.message });
    if (dipakai.length > 0) {
      return res.status(409).json({ pesan: 'SKS tidak bisa diubah karena sudah ada mahasiswa yang mengambil mata kuliah ini' });
    }
  }

  if (!(await dosenValid(req.db, input.nilai.dosen_id))) {
    return res.status(400).json({ pesan: 'Dosen pengampu harus akun berperan dosen' });
  }

  const { data, error } = await req.db
    .from('mata_kuliah')
    .update(input.nilai)
    .eq('id', req.params.id)
    .select();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ pesan: 'Kode mata kuliah sudah dipakai' });
    }
    return res.status(400).json({ pesan: error.message });
  }
  if (data.length === 0) {
    return res.status(403).json({ pesan: 'Hanya admin yang boleh mengubah mata kuliah' });
  }
  res.json(data[0]);
});

// Hapus (RLS: hanya admin)
router.delete('/:id', async (req, res) => {
  // Aturan: mata kuliah yang sudah masuk KRS tidak boleh dihapus, karena
  // menghapusnya ikut menghapus KRS, nilai, dan presensi mahasiswa.
  const { data: dipakai, error: errPakai } = await req.db
    .from('krs')
    .select('id')
    .eq('mata_kuliah_id', req.params.id)
    .limit(1);
  if (errPakai) return res.status(400).json({ pesan: 'ID mata kuliah tidak valid' });
  if (dipakai.length > 0) {
    return res.status(409).json({ pesan: 'Mata kuliah tidak bisa dihapus karena sudah ada KRS yang memakainya' });
  }

  const { data, error } = await req.db
    .from('mata_kuliah')
    .delete()
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(400).json({ pesan: error.message });
  if (data.length === 0) {
    return res.status(403).json({ pesan: 'Hanya admin yang boleh menghapus mata kuliah' });
  }
  res.json({ pesan: 'Mata kuliah dihapus' });
});

module.exports = router;