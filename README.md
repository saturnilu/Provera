# Provera: Face Recognition Exam Proctoring

Web app kuis/ujian dengan 3 role (admin, lecturer, student), room-based dengan
kode undangan one-time-use, dan proctoring wajah real-time selama ujian
berlangsung. Ini scaffold **MVP yang jalan penuh** (bukan mockup) sehingga
bisa langsung dijalankan lokal, tapi masih ada beberapa hal yang perlu
dipoles lagi buat production (lihat "Extension points" di bawah).

## Struktur

```
provera/
├── server/     Node.js + Express + Socket.IO + SQLite (better-sqlite3)
└── client/     React + Vite + Tailwind + face-api.js
```

## Cara Menjalankan

### 1. Backend

```bash
cd server
npm install
cp .env.example .env    
node src/seed.js admin@example.com admin123 "Admin"  
npm run dev            
```

### 2. Frontend

```bash
cd client
npm install
npm run dev             
```

Buka `http://localhost:5173` di browser. Daftar sebagai lecturer di satu
tab, dan sebagai student di tab/browser lain (atau incognito) buat nyoba
alur lengkapnya.

## Alur Coba Cepat

1. **Lecturer**: register → buat room → tambah beberapa soal (essay/MC/dropdown, bisa diedit/dihapus kapan saja sebelum ujian dimulai) → generate kode undangan (satu kode, dipakai bersama sampai 50 siswa).
2. **Student**: register → coba join room tanpa daftar wajah dulu (akan ditolak, diarahkan ke halaman daftar wajah) → buka `/student/enroll-face` untuk daftarin wajah (butuh izin kamera) → balik ke `/student` → masukkan kode undangan (berhasil).
3. **Lecturer**: buka detail room, klik **Mulai Ujian**.
4. **Student**: browser otomatis minta izin kamera+mikrofon, soal muncul, timer jalan (timer dihitung di server, jadi tetap akurat walau halaman di-refresh). Coba submit sebelum semua soal dijawab, tombol submit disabled sampai semua terjawab. Coba nengok/keluar frame kamera buat lihat overlay blur & notifikasi trigger.
5. **Lecturer**: di halaman room yang sama, lihat status peserta & notifikasi pelanggaran muncul real-time di panel "Live Monitoring".
6. **Lecturer**: klik **Akhiri Sekarang** atau tunggu waktu habis (auto-submit tetap jalan walau siswa belum jawab semua) → buka **Lihat Rekap** untuk skor & log pelanggaran per siswa.

## Catatan Teknis Penting

- **Model face-api.js** di-load dari CDN (`raw.githubusercontent.com/justadudewhohacks/face-api.js`)
  saat runtime di browser, jadi nggak perlu vendor file model manual. Untuk produksi,
  sebaiknya self-host folder `/models` biar nggak bergantung ke CDN pihak ketiga.
- **Perbandingan wajah dilakukan di client** (browser siswa), bukan di server,
  karena server cuma nerima *event* pelanggaran & descriptor saat enrollment, bukan video mentah.
  Ini sesuai desain di `architecture.md`.
- **Database**: SQLite file (`server/data.sqlite`), cukup buat development/demo.
  Untuk produksi/multi-instance, ganti ke PostgreSQL (skema di `architecture.md`
  hampir 1:1 sama dengan tabel SQLite di `server/src/db.js`, tinggal migrasi driver-nya).
- **Realtime**: Socket.IO, satu channel per room (`room:<id>`), lecturer juga join
  channel tambahan (`room:<id>:lecturer`) supaya notifikasi pelanggaran live cuma
  masuk ke dashboard lecturer, bukan ke siswa lain.

## Extension Points (belum diimplementasi penuh di MVP ini)

- **Admin panel** masih placeholder karena belum ada UI kelola akun lecturer/lihat semua room.
- **Grading essay manual**: endpoint (`POST /api/rooms/answers/:id/grade`) sudah ada,
  tapi belum ada halaman UI-nya di frontend untuk lecturer, tinggal bikin form di halaman Recap.
- **Snapshot foto saat pelanggaran** (untuk bukti visual) belum diimplementasi, baru
  mencatat jenis & waktu pelanggaran dan belum capture frame.
- **Deteksi objek mencurigakan (HP, buku) & analisis audio** disebut "out of scope v1" di PRD.
- **Multiple codes per bulk-invite** bisa dikirim ke siswa lewat email otomatis, tapi sekarang
  masih ditampilkan manual di dashboard lecturer buat dicopy.

## Warna / Design System

Tailwind config (`client/tailwind.config.js`) sudah pakai token warna dari
`design-system.md`: `background`, `card`, `primary` (+ `primary-light`),
`navy`, `body`, `border`, `success`, `warning`, `danger`.