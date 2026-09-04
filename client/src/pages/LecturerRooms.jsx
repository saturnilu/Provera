import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function LecturerRooms() {
  const { auth } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);

  async function refresh() {
    setRooms(await api.listRooms(auth.token));
  }
  useEffect(() => { refresh(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await api.createRoom({ title, duration_minutes: Number(duration) }, auth.token);
    setTitle('');
    refresh();
  }

  const statusLabel = {
    draft: 'Draft', waiting: 'Menunggu peserta', in_progress: 'Sedang berlangsung', ended: 'Selesai',
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-navy mb-6">Room Ujian Saya</h1>

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 mb-8 flex gap-3 items-end flex-wrap">
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
        <button className="bg-primary text-white rounded-md px-4 py-2 font-medium h-[42px]">Buat Room</button>
      </form>

      <div className="space-y-3">
        {rooms.map((r) => (
          <Link key={r.id} to={`/lecturer/rooms/${r.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary transition">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-navy">{r.title}</p>
                <p className="text-sm text-body">{r.duration_minutes} menit · {statusLabel[r.status] || r.status}</p>
              </div>
            </div>
          </Link>
        ))}
        {rooms.length === 0 && <p className="text-body text-sm">Belum ada room. Buat satu di atas.</p>}
      </div>
    </div>
  );
}