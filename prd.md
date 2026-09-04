# PRD: Provera, Multi-Role Quiz/Exam Platform with Face Recognition Proctoring

## 1. Ringkasan Produk
Web app kuis/ujian online dengan 3 role (Admin, Lecturer, Student), berbasis
**room/ruangan ujian**. Lecturer membuat room, mengatur soal & durasi, mengundang siswa
lewat kode one-time-use, lalu mengontrol jalannya ujian secara live. Selama ujian,
sistem melakukan face recognition proctoring untuk memastikan identitas siswa dan
mendeteksi indikasi kecurangan.

## 2. Roles

| Role | Deskripsi |
|---|---|
| **Admin** (dev/Saturn) | Kelola platform secara keseluruhan: akun lecturer, monitoring sistem, tidak terlibat di alur ujian sehari-hari |
| **Lecturer** | Membuat room, membuat soal, generate kode invite, mengontrol sesi ujian (start/extend/end), menerima rekap hasil, hapus room |
| **Student** | Join room pakai kode, mengerjakan soal, diawasi lewat kamera & mikrofon selama ujian berlangsung |

## 3. Alur Utama (End-to-End)

1. **Lecturer bikin room**, lalu set judul, durasi ujian, dan susun soal.
2. **Lecturer generate kode invite** berupa kode **one-time-use** (satu kode hanya bisa dipakai sekali oleh satu siswa; lecturer bisa generate banyak kode sekaligus untuk banyak siswa, atau generate ulang kalau ada yang salah kirim/bocor).
3. **Siswa join room** pakai kode → masuk ke "waiting room", belum bisa lihat soal.
4. **Lecturer pencet Start** setelah semua siswa yang diharapkan sudah join.
5. Begitu ujian dimulai, browser siswa **otomatis minta izin akses kamera & mikrofon**. Kalau ditolak, siswa tidak bisa lanjut mengerjakan (di-block sampai izin diberikan).
6. Selama ujian berlangsung, seluruh **proctoring case** aktif (lihat §5).
7. **Lecturer bisa kontrol sesi secara live:**
   - Tambah waktu (extend)
   - Akhiri ujian lebih cepat untuk semua siswa (end early)
   - Biarkan waktu habis otomatis sesuai setting awal
8. Setelah ujian selesai (dengan cara apapun di atas), sistem generate **rekap hasil** ke lecturer: skor tiap siswa, jumlah benar dari total soal, status pelanggaran per siswa.
9. Lecturer bisa **hapus room** kapan saja, dan begitu dihapus, room & kode invite terkait ikut hilang.

## 4. Fitur Soal (dibuat oleh Lecturer)

| Tipe Soal | Pengaturan |
|---|---|
| **Essay** | Lecturer set batas jumlah kata (min/maks); tidak auto-graded, ditandai "needs manual review" untuk dinilai lecturer sendiri |
| **Multiple choice** | Lecturer pilih mode: **single-select** (radio) atau **multi-select** (checkbox, boleh pilih lebih dari satu jawaban benar) |
| **Dropdown** | Single-select lewat UI dropdown, cocok untuk soal dengan banyak opsi tanpa makan tempat |

Semua tipe soal (kecuali essay) di-auto-grade langsung setelah ujian selesai.

## 5. Proctoring Cases (aktif setelah lecturer pencet Start)

| Case | Kondisi | Aksi Sistem |
|---|---|---|
| Face not detected | Wajah tidak terlihat (nunduk/nengok/keluar frame) | Layar blur + notifikasi |
| Face not recognized | Wajah terdeteksi tapi tidak cocok dengan siswa yang login | Layar blur + notifikasi, event dicatat |
| Multiple faces detected | Lebih dari satu wajah di frame | Layar blur + notifikasi, pelanggaran tinggi |
| Face partially obscured | Wajah tertutup sebagian, confidence rendah | Notifikasi ringan, tidak langsung blur |
| Poor lighting / low confidence | Confidence rendah tapi bukan wajah hilang | Notifikasi ringan |
| Tab switch / window blur | Siswa pindah tab/minimize window | Notifikasi + event dicatat |
| Camera/mic disconnected | Kamera/mic mati atau izin dicabut di tengah ujian | Ujian dijeda, notifikasi minta re-enable, event dicatat |
| Prolonged violation | Salah satu kondisi di atas berlangsung lama (misal >30 detik) | Auto-flag sesi siswa sebagai "needs review" |

## 5.1 Live Monitoring untuk Lecturer (selama ujian berlangsung)
- Selagi ujian jalan, lecturer melihat dashboard real-time berisi daftar semua siswa di room beserta status masing-masing (misal: "normal" / "warning aktif").
- Begitu ada siswa yang kena salah satu proctoring case di atas (§5), **notifikasi muncul langsung di dashboard lecturer**, jadi tidak cuma tercatat di log untuk direview belakangan. Notifikasi menampilkan nama siswa & jenis pelanggaran (misal "Budi, face not recognized").
- Lecturer bisa klik salah satu siswa untuk lihat detail (riwayat pelanggaran siswa itu sejauh ini selama sesi berjalan).
- Opsional: lecturer bisa langsung mengambil aksi dari dashboard ini, misal kirim reminder ke siswa tertentu, atau langsung end sesi siswa itu individual kalau pelanggarannya berat.

## 6. Rekap Hasil (untuk Lecturer)

Per room, setelah ujian berakhir:
- Daftar siswa + skor akhir (jumlah benar dari total soal objektif)
- Status essay: sudah/belum dinilai manual
- Ringkasan pelanggaran per siswa (jenis & jumlah event)
- Bisa export (CSV) untuk keperluan administrasi

## 7. Non-Functional Requirements & Catatan Desain
- **Real-time sync:** semua siswa di room yang sama harus menerima sinyal "Start"/"End"/"Extend time" secara bersamaan (butuh WebSocket, bukan cuma polling REST).
- **Data retention saat room dihapus:** rekap hasil ujian (skor, jawaban, log pelanggaran) sebaiknya **tetap disimpan terpisah** dari room meski room-nya dihapus, supaya lecturer tidak kehilangan histori nilai siswa.
- **Privacy:** data wajah & rekaman kamera diberi tahu ke siswa lewat consent screen sebelum izin diminta.
- **Kode invite:** harus unik per room, expired otomatis setelah dipakai sekali atau setelah room dihapus.

## 8. Out of Scope (v1)
- Deteksi otomatis dari audio (percakapan, noise); mic disiapkan tapi belum dipakai untuk analisis.
- Deteksi objek mencurigakan (HP, buku) via object detection.
- Auto-grading essay (misal pakai LLM); masih manual review oleh lecturer.
- Mobile app version.

## 9. Success Metrics
- Semua siswa di room menerima sinyal start/end secara real-time tanpa delay signifikan.
- Akurasi face matching terjaga (false accept/reject rate rendah).
- Waktu lecturer untuk generate rekap hasil = instant setelah ujian berakhir (tidak perlu hitung manual).