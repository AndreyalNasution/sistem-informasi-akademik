require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const opsi = { auth: { persistSession: false, autoRefreshToken: false } };

// Klien umum (belum login)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  opsi
);

// Klien atas nama pengguna yang sudah login (RLS memakai identitas dia)
function supabaseUntukToken(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    ...opsi,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

module.exports = supabase;
module.exports.supabaseUntukToken = supabaseUntukToken;