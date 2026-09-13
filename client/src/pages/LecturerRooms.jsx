import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function LecturerRooms() {
  const { auth } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [courseId, setCourseId] = useState('');
  const [assistantEmails, setAssistantEmails] = useState('');
  const [skipped, setSkipped] = useState([]);

  async function refresh() {
    const [roomList, courseList] = await Promise.all([api.listRooms(auth.token), api.listCourses(auth.token)]);
    setRooms(roomList);
    setCourses(courseList);
  }
  useEffect(() => { refresh(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const emails = assistantEmails.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await api.createRoom(
      { title, duration_minutes: Number(duration), assistant_emails: emails, course_id: courseId || undefined },
      auth.token
    );
    setSkipped(res.skippedAssistantEmails || []);
    setTitle('');
    setAssistantEmails('');
    refresh();
  }

  const statusLabel = {
    draft: 'Draft', waiting: 'Menunggu peserta', in_progress: 'Sedang berlangsung', ended: 'Selesai',
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-navy">Room Ujian Saya</h1>
        <Link to="/lecturer/courses" className="text-sm text-primary font-medium">Kelola Mata Kuliah</Link>
      </div>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 mb-8 space-y-3">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm text-body mb-1">Judul room</label>
            <input className="w-full border border-border rounded-md px-3 py-2" value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="Kuis Mandarin — Bab 3" required />
          </div>
          <div className="w-32">
            <label className="block text-sm text-body mb-1">Durasi (menit)</label>
            <input type="number" min="1" className="w-full border border-border rounded-md px-3 py-2"
              value={duration} onChange={(e) => setDuration(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="block text-sm text-body mb-1">Mata kuliah <span className="text-body">(opsional)</span></label>
          <select className="w-full border border-border rounded-md px-3 py-2 bg-card" value={courseId}
            onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— Tanpa mata kuliah —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </select>
          {courses.length === 0 && (
            <p className="text-xs text-body mt-1">
              Belum punya mata kuliah. <Link to="/lecturer/courses" className="text-primary font-medium">Bikin dulu di sini</Link>, biar room ini bisa dikelompokkan.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm text-body mb-1">
            Email pengawas/asisten <span className="text-body">(opsional, pisahkan dengan koma)</span>
          </label>
          <input className="w-full border border-border rounded-md px-3 py-2" value={assistantEmails}
            onChange={(e) => setAssistantEmails(e.target.value)} placeholder="asisten1@kampus.ac.id, asisten2@kampus.ac.id" />
          <p className="text-xs text-body mt-1">Harus sudah punya akun lecturer terdaftar. Bisa ditambah/dihapus kapan saja dari halaman room.</p>
        </div>
        <button className="bg-primary text-white rounded-md px-4 py-2 font-medium">Buat Room</button>
        {skipped.length > 0 && (
          <p className="text-sm text-warning">
            Gak ketemu akun lecturer untuk: {skipped.join(', ')} — dilewati, bisa dicoba lagi dari halaman room.
          </p>
        )}
      </form>

      <div className="space-y-3">
        {rooms.map((r) => (
          <Link key={r.id} to={`/lecturer/rooms/${r.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary transition">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-navy">{r.title}</p>
                <p className="text-sm text-body">
                  {r.duration_minutes} menit · {statusLabel[r.status] || r.status}
                  {r.course_name && <> · {r.course_name}</>}
                </p>
              </div>
              {r.myRole === 'assistant' && (
                <span className="text-xs font-medium text-primary bg-primary-light rounded-full px-2 py-1 shrink-0">Asisten</span>
              )}
            </div>
          </Link>
        ))}
        {rooms.length === 0 && <p className="text-body text-sm">Belum ada room. Buat satu di atas.</p>}
      </div>
    </div>
  );
}