function el(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

const MENU = {
  admin: [
    ['Dashboard', '/dashboard.html'],
    ['Mata Kuliah', '/mata-kuliah.html'],
  ],
  dosen: [
    ['Dashboard', '/dashboard.html'],
    ['Mata Kuliah', '/mata-kuliah.html'],
    ['Nilai', '/nilai.html'],
    ['Presensi', '/presensi.html'],
  ],
  mahasiswa: [
    ['Dashboard', '/dashboard.html'],
    ['Mata Kuliah & KRS', '/mata-kuliah.html'],
    ['Nilai', '/nilai.html'],
    ['Presensi', '/presensi.html'],
  ],
};

// Membangun sidebar + topbar, lalu mengembalikan elemen kosong untuk isi halaman.
function buatKerangka(judul) {
  const profil = ambilProfil();
  if (!profil) { location.href = '/'; return null; }

  const root = document.getElementById('root');
  const app = el('div', 'app');

  const sidebar = el('aside', 'sidebar');
  sidebar.append(el('div', 'brand', 'SIA'));
  const menu = el('nav', 'menu');
  (MENU[profil.role] || MENU.mahasiswa).forEach(([label, href]) => {
    const a = el('a', location.pathname === href ? 'aktif' : '', label);
    a.href = href;
    menu.append(a);
  });
  sidebar.append(menu);

  const bawah = el('div', 'bawah');
  const btnKeluar = el('button', 'abu kecil', 'Keluar');
  btnKeluar.type = 'button';
  btnKeluar.addEventListener('click', keluar);
  bawah.append(btnKeluar);
  sidebar.append(bawah);

  const utama = el('div', 'utama');
  const topbar = el('header', 'topbar');
  topbar.append(el('h1', '', judul));
  const pengguna = el('div', 'pengguna');
  pengguna.append(
    el('div', 'avatar', profil.nama.charAt(0).toUpperCase()),
    el('span', '', profil.nama),
    el('span', 'lencana', profil.role)
  );
  topbar.append(pengguna);

  const konten = el('main', 'konten');
  utama.append(topbar, konten);
  app.append(sidebar, utama);
  root.replaceChildren(app);
  return konten;
}

// Membuat tabel dari daftar judul kolom dan baris (isi sel: teks atau elemen).
function buatTabel(kepala, baris) {
  const bungkus = el('div', 'tabel-bungkus');
  const tabel = el('table');
  const thead = el('thead');
  const trKepala = el('tr');
  kepala.forEach((h) => trKepala.append(el('th', '', h)));
  thead.append(trKepala);
  tabel.append(thead);

  const tbody = el('tbody');
  baris.forEach((isi) => {
    const tr = el('tr');
    isi.forEach((sel) => {
      const td = el('td');
      td.append(sel instanceof Node ? sel : document.createTextNode(String(sel)));
      tr.append(td);
    });
    tbody.append(tr);
  });
  tabel.append(tbody);
  bungkus.append(tabel);
  return bungkus;
}