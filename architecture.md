# Architecture: Provera, Multi-Role Quiz Platform with Face Recognition Proctoring

## 1. High-Level Overview

```
┌───────────────────────────────┐
│      Browser (Client)          │
│  Next.js/React + face-api.js   │
│  Role-based UI: Admin/Lecturer/│
│  Student                       │
│  Webcam+Mic ──> Detection Loop │
└───────────────┬─────────────────┘
                │ REST (CRUD) + WebSocket (live control)
                ▼
┌───────────────────────────────┐
│        Backend (Node.js)       │
│  Auth · Room mgmt · Question   │
│  mgmt · Session control ·      │
│  Grading · Violation logging   │
└───────────────┬─────────────────┘
                ▼
┌───────────────────────────────┐
│          PostgreSQL DB         │
│ users · rooms · invite_codes · │
│ questions · sessions · answers │
│ · violation_logs               │
└───────────────────────────────┘
```

Dua jalur komunikasi utama:
- **REST API** untuk operasi CRUD biasa (bikin room, bikin soal, generate kode, lihat rekap).
- **WebSocket** untuk hal yang harus real-time ke semua siswa sekaligus: sinyal "Start ujian", "Extend time", "End exam now" dari lecturer harus sampai ke semua browser siswa di room yang sama tanpa delay/polling.

Face detection & recognition tetap **client-side** (face-api.js) seperti desain sebelumnya, sehingga backend cuma terima descriptor & event pelanggaran, bukan raw video stream.

## 2. Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js (React) | Role-based routing (admin/lecturer/student) gampang di-handle dengan middleware |
| Realtime | Socket.IO (di atas Node.js) | Broadcast event per-room (start/extend/end) ke semua siswa yang join |
| Face Detection | face-api.js (TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet) | Sama seperti desain awal, jalan di browser |
| Backend | Node.js + Express + Socket.IO | Konsisten dengan stack Konekta |
| Database | PostgreSQL | Relational, cocok untuk struktur room → questions → sessions → answers |
| Auth | JWT + role claim (admin/lecturer/student) | Role-based access control di tiap endpoint |
| File/snapshot storage | S3-compatible (Supabase Storage/Cloudflare R2) | Simpan foto enrollment & snapshot pelanggaran |

## 3. Data Model

**users**
`id, name, email, password_hash, role (admin/lecturer/student), created_at`

**face_embeddings**
`id, user_id (FK), embedding (float[128]), photo_url, created_at`

**rooms**
`id, lecturer_id (FK), title, duration_minutes, status (draft/waiting/in_progress/ended), started_at, ended_at, created_at`

**invite_codes**
`id, room_id (FK), code (unique), is_used (bool), used_by_user_id (FK, nullable), created_at`

**questions**
`id, room_id (FK), type (essay/mcq_single/mcq_multi/dropdown), prompt, options (JSON, untuk mcq/dropdown), correct_answer (JSON, null untuk essay), word_limit_min, word_limit_max (untuk essay), points, order_index`

**room_sessions** *(1 baris = 1 siswa yang join & mengerjakan 1 room)*
`id, room_id (FK), student_id (FK), joined_at, exam_started_at, exam_ended_at, status (waiting/in_progress/completed/flagged), total_score`

**answers**
`id, room_session_id (FK), question_id (FK), answer_value (JSON), is_correct (nullable, null untuk essay sebelum dinilai), score, graded_by (FK lecturer, nullable, untuk essay), graded_at`

**violation_logs**
`id, room_session_id (FK), type (face_not_detected/face_not_recognized/multiple_faces/tab_switch/camera_disconnected/...), timestamp, duration_seconds, snapshot_url (nullable)`

## 4. Alur Real-Time (Room Lifecycle)

1. Lecturer bikin room (`status: draft`) → tambah soal → generate invite codes.
2. Siswa join pakai kode → `room_sessions` row dibuat (`status: waiting`), kode ditandai `is_used: true`. Room jadi `status: waiting`.
3. Lecturer pencet **Start** → backend broadcast event `exam:start` via WebSocket ke semua socket yang subscribe ke room itu → `rooms.status = in_progress`, tiap `room_sessions.exam_started_at` di-set.
4. Client siswa terima `exam:start` → trigger `getUserMedia({ video: true, audio: true })` → mulai detection loop & mulai timer soal.
5. Lecturer bisa kirim:
   - `exam:extend_time { minutes }` → broadcast ke semua siswa, update timer client-side & `rooms` metadata.
   - `exam:end_now` → broadcast, force submit semua siswa yang masih `in_progress`.
6. Timer habis natural (client-side countdown) → client auto-submit sendiri (tidak perlu nunggu sinyal server), tapi tetap kirim event completion ke backend.
6.1. **Live monitoring ke lecturer:** setiap kali client siswa kirim `violation:report` ke server, backend langsung **broadcast ulang** event itu ke socket lecturer yang sedang buka dashboard room tersebut (event `violation:live`), sekaligus disimpan ke `violation_logs`. Jadi lecturer lihat notifikasi real-time tanpa perlu refresh/polling, dan datanya tetap persist untuk direview di rekap nanti.
7. Setelah semua `room_sessions` di room itu `completed` (atau di-force lewat `end_now`), backend hitung skor otomatis untuk soal non-essay, generate rekap, dan available buat lecturer di dashboard.
8. Lecturer hapus room → `rooms.status = deleted` (soft delete) + invite_codes yang belum kepake ikut invalidated; `room_sessions`/`answers`/`violation_logs` tetap ada untuk histori.

## 5. Key API & Socket Events

**REST**
```
POST   /auth/login
POST   /lecturer/rooms                         # bikin room
POST   /lecturer/rooms/:id/questions           # tambah soal
POST   /lecturer/rooms/:id/invite-codes        # generate kode (bulk)
POST   /student/rooms/join                     # redeem kode → join room
POST   /admin/users/:id/enroll                 # upload foto, generate face embedding
GET    /lecturer/rooms/:id/recap               # rekap hasil setelah ujian selesai
POST   /lecturer/rooms/:id/answers/:answerId/grade   # nilai essay manual
DELETE /lecturer/rooms/:id                     # soft-delete room
```

**WebSocket (namespaced per room)**
```
server -> client: exam:start
server -> client: exam:extend_time { minutes }
server -> client: exam:end_now
client -> server: violation:report { type, timestamp, duration }
client -> server: exam:submit { answers }
server -> lecturer: violation:live { studentId, studentName, type, timestamp }
```

## 6. Security & Privacy Considerations
- Role-based middleware di tiap endpoint (student tidak bisa akses endpoint lecturer, dst).
- Invite code single-use, di-invalidate otomatis begitu dipakai atau begitu room dihapus.
- Descriptor wajah (bukan foto mentah) yang dikirim ke client saat sesi ujian dimulai.
- Consent screen sebelum `getUserMedia` dipanggil, jelasin ke siswa apa yang dimonitor.
- Snapshot pelanggaran (kalau ada) disimpan dengan retensi terbatas, terpisah dari room agar tidak ikut kehapus saat room di-soft-delete.

## 7. Deployment (MVP)
- Frontend: Vercel.
- Backend + Socket.IO: satu service di Railway/Render (WebSocket butuh persistent connection, jadi hindari platform yang cuma serverless functions biasa).
- DB: Managed PostgreSQL (Railway/Supabase).
- Object storage: Supabase Storage atau Cloudflare R2.