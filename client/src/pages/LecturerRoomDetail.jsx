import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { socket } from '../socket';
import QuestionEditor from '../components/QuestionEditor';
import StatusDot from '../components/StatusDot';

export default function LecturerRoomDetail() {
  const { roomId } = useParams();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]); 
  const [statusByStudent, setStatusByStudent] = useState({}); 

  async function refresh() {
    setData(await api.getRoom(roomId, auth.token));
  }
  useEffect(() => { refresh(); }, [roomId]);

  useEffect(() => {
    socket.emit('room:join', { roomId, role: 'lecturer' });

    const onViolationLive = ({ studentName, type, timestamp }) => {
      setLiveEvents((prev) => [{ studentName, type, timestamp }, ...prev].slice(0, 50));
      const severity = ['face_not_recognized', 'multiple_faces', 'camera_disconnected'].includes(type)
        ? 'danger' : 'warning';
      setStatusByStudent((prev) => ({ ...prev, [studentName]: severity }));
    };
    const onCompleted = ({ studentName }) => {
      setStatusByStudent((prev) => ({ ...prev, [studentName]: 'success' }));
    };
    const onExamStart = () => refresh();
    const onExamEnd = () => refresh();

    socket.on('violation:live', onViolationLive);
    socket.on('exam:student_completed', onCompleted);
    socket.on('exam:start', onExamStart);
    socket.on('exam:end_now', onExamEnd);
    return () => {
      socket.off('violation:live', onViolationLive);
      socket.off('exam:student_completed', onCompleted);
      socket.off('exam:start', onExamStart);
      socket.off('exam:end_now', onExamEnd);
    };
  }, [roomId]);

  if (!data) return <p className="p-8 text-body">Memuat…</p>;
  const { room, questions, participants } = data;

  async function handleAddQuestion(payload) {
    await api.addQuestion(roomId, payload, auth.token);
    refresh();
  }
  async function handleSaveQuestion(questionId, payload) {
    await api.updateQuestion(roomId, questionId, payload, auth.token);
    setEditingQuestion(null);
    refresh();
  }
  async function handleDeleteQuestion(questionId) {
    if (!confirm('Hapus soal ini?')) return;
    await api.deleteQuestion(roomId, questionId, auth.token);
    refresh();
  }

  async function handleGenerateCode() {
    await api.generateCode(roomId, auth.token);
    refresh();
  }

  function handleStart() {
    socket.emit('exam:start', { roomId });
  }
  function handleExtend() {
    const minutes = Number(prompt('Tambah berapa menit?', '5'));
    if (minutes > 0) socket.emit('exam:extend', { roomId, minutes });
  }
  function handleEnd() {
    if (confirm('Akhiri ujian sekarang untuk semua siswa?')) {
      socket.emit('exam:end', { roomId });
    }
  }
  async function handleDelete() {
    if (confirm('Hapus room ini? Kode undangan akan hilang. Nilai & log tetap tersimpan.')) {
      await api.deleteRoom(roomId, auth.token);
      navigate('/lecturer');
    }
  }

  const isEditable = room.status === 'draft' || room.status === 'waiting';

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <Link to="/lecturer" className="text-sm text-primary font-medium">&larr; Kembali ke Dashboard</Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{room.title}</h1>
          <p className="text-sm text-body">{room.duration_minutes} menit · status: {room.status}</p>
        </div>
        <div className="flex gap-2">
          {isEditable && (
            <button onClick={handleStart} className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium">
              Mulai Ujian
            </button>
          )}
          {room.status === 'in_progress' && (
            <>
              <button onClick={handleExtend} className="border border-primary text-primary rounded-md px-4 py-2 text-sm font-medium">
                + Waktu
              </button>
              <button onClick={handleEnd} className="border border-danger text-danger rounded-md px-4 py-2 text-sm font-medium">
                Akhiri Sekarang
              </button>
            </>
          )}
          {room.status === 'ended' && (
            <Link to={`/lecturer/rooms/${roomId}/recap`} className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium">
              Lihat Rekap
            </Link>
          )}
          <button onClick={handleDelete} className="border border-border text-body rounded-md px-4 py-2 text-sm font-medium">
            Hapus Room
          </button>
        </div>
      </div>

      {room.status === 'in_progress' && (
        <section>
          <h2 className="font-medium text-navy mb-3">Live Monitoring</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-body mb-2">Status peserta</p>
              <ul className="space-y-2">
                {participants.map((p) => (
                  <li key={p.session_id} className="flex items-center gap-2 text-sm">
                    <StatusDot status={statusByStudent[p.name] || 'neutral'} />
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-body mb-2">Notifikasi pelanggaran (live)</p>
              <ul className="space-y-1 text-sm">
                {liveEvents.map((ev, i) => (
                  <li key={i} className="text-navy">
                    <span className="font-medium">{ev.studentName}</span> — {ev.type}
                  </li>
                ))}
                {liveEvents.length === 0 && <li className="text-body">Belum ada pelanggaran.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {isEditable ? (
        <>
          <section>
            <h2 className="font-medium text-navy mb-3">Soal ({questions.length})</h2>
            <div className="space-y-2 mb-4">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-card border border-border rounded-lg p-3 text-sm flex justify-between items-center gap-3">
                  <span><span className="text-body">{i + 1}. [{q.type}]</span> {q.prompt}</span>
                  <span className="flex gap-3 shrink-0">
                    <button onClick={() => setEditingQuestion(q)} className="text-primary font-medium">Edit</button>
                    <button onClick={() => handleDeleteQuestion(q.id)} className="text-danger font-medium">Hapus</button>
                  </span>
                </div>
              ))}
              {questions.length === 0 && <p className="text-body text-sm">Belum ada soal.</p>}
            </div>
            <QuestionEditor
              editing={editingQuestion}
              onAdd={handleAddQuestion}
              onSave={handleSaveQuestion}
              onCancel={() => setEditingQuestion(null)}
            />
          </section>

          <section>
            <h2 className="font-medium text-navy mb-3">Kode Undangan</h2>
            <p className="text-sm text-body mb-3">
              Satu kode dipakai bersama oleh sampai <strong>{room.max_participants} siswa</strong> per room — bukan sekali pakai per siswa.
            </p>
            {room.join_code ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-semibold text-primary tracking-widest bg-primary-light px-4 py-2 rounded-md">
                  {room.join_code}
                </span>
                <span className="text-sm text-body">{participants.length}/{room.max_participants} siswa join</span>
                <button onClick={handleGenerateCode} className="text-sm text-primary font-medium">Generate ulang</button>
              </div>
            ) : (
              <button onClick={handleGenerateCode} className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium">
                Generate Kode
              </button>
            )}
          </section>
        </>
      ) : (
        <section>
          <h2 className="font-medium text-navy mb-3">Peserta ({participants.length})</h2>
          <ul className="space-y-1 text-sm">
            {participants.map((p) => (
              <li key={p.session_id} className="flex justify-between bg-card border border-border rounded-lg px-3 py-2">
                <span>{p.name}</span>
                <span className="text-body">{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}