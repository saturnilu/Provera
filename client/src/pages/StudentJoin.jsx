import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function StudentJoin() {
  const { auth } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [needsFace, setNeedsFace] = useState(false);
  const navigate = useNavigate();

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setNeedsFace(false);
    try {
      const { room } = await api.joinRoom(code, auth.token);
      navigate(`/student/rooms/${room.id}`);
    } catch (err) {
      if (err.code === 'FACE_NOT_ENROLLED') {
        setNeedsFace(true);
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="max-w-sm mx-auto py-16 px-4">
      <h1 className="text-xl font-semibold text-navy mb-2">Gabung Room Ujian</h1>
      <p className="text-sm text-body mb-6">Masukkan kode yang diberikan lecturer kamu.</p>
      <form onSubmit={handleJoin} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        {needsFace && (
          <div className="bg-warning/10 border border-warning rounded-md p-3 text-sm">
            <p className="text-navy mb-2">Kamu belum mendaftarkan wajah — ini wajib sebelum bisa join room manapun.</p>
            <Link to="/student/enroll-face" className="text-primary font-medium">Daftarkan wajah sekarang &rarr;</Link>
          </div>
        )}
        <input
          className="w-full border border-border rounded-md px-3 py-2 tracking-widest uppercase text-center font-mono"
          value={code} onChange={(e) => setCode(e.target.value)} placeholder="KODE6DIGIT" required
        />
        <button className="w-full bg-primary text-white rounded-md py-2 font-medium">Gabung</button>
      </form>
      <a href="/student/enroll-face" className="block text-center text-sm text-primary mt-6">
        Belum daftar wajah? Klik di sini
      </a>
    </div>
  );
}