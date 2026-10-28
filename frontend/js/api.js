const KUNCI_TOKEN = 'sia_token';
const KUNCI_PROFIL = 'sia_profil';

function simpanSesi(token, profile) {
  sessionStorage.setItem(KUNCI_TOKEN, token);
  sessionStorage.setItem(KUNCI_PROFIL, JSON.stringify(profile));
}

function ambilProfil() {
  try { return JSON.parse(sessionStorage.getItem(KUNCI_PROFIL)); }
  catch { return null; }
}

function keluar() {
  sessionStorage.clear();
  location.href = '/';
}

async function api(path, opsi = {}) {
  const token = sessionStorage.getItem(KUNCI_TOKEN);
  const headers = { 'Content-Type': 'application/json', ...(opsi.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...opsi, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== '/api/login') keluar();
  if (!res.ok) throw new Error(data.pesan || 'Terjadi kesalahan');
  return data;
}