import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { api } from '../api';
import { socket, connectSocket } from '../socket';
import QuestionEditor from '../components/QuestionEditor';
import StatusDot from '../components/StatusDot';
import { RoomDetailSkeleton } from '../components/Skeleton';
import BankPickerModal from '../components/BankPickerModal';

export default function LecturerRoomDetail() {
  const { roomId } = useParams();
  const { auth } = useAuth();
  const { confirmDialog, promptDialog } = useModal();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [savingToBank, setSavingToBank] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [statusByStudent, setStatusByStudent] = useState({});
  const [newAssistantEmail, setNewAssistantEmail] = useState('');
  const [assistantError, setAssistantError] = useState('');

  async function refresh() {
    setData(await api.getRoom(roomId, auth.token));
  }
  useEffect(() => { refresh(); }, [roomId]);

  useEffect(() => {
    connectSocket(auth.token);
    socket.emit('room:join', { roomId });

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
    const onParticipantJoined = () => refresh();

    socket.on('violation:live', onViolationLive);
    socket.on('exam:student_completed', onCompleted);
    socket.on('exam:start', onExamStart);
    socket.on('exam:end_now', onExamEnd);
    socket.on('room:participant_joined', onParticipantJoined);
    return () => {
      socket.off('violation:live', onViolationLive);
      socket.off('exam:student_completed', onCompleted);
      socket.off('exam:start', onExamStart);
      socket.off('exam:end_now', onExamEnd);
      socket.off('room:participant_joined', onParticipantJoined);
    };
  }, [roomId]);

  if (!data) return <RoomDetailSkeleton />;
  const { room, questions, participants, assistants, isOwner } = data;

  async function handleAddAssistant(e) {
    e.preventDefault();
    setAssistantError('');
    try {
      await api.addAssistant(roomId, newAssistantEmail.trim(), auth.token);
      setNewAssistantEmail('');
      refresh();
    } catch (err) {
      setAssistantError(err.message || 'Gagal menambahkan asisten');
    }
  }
  async function handleRemoveAssistant(userId) {
    await api.removeAssistant(roomId, userId, auth.token);
    refresh();
  }

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
    const ok = await confirmDialog({
      title: 'Hapus soal ini?',
      message: 'Soal dan jawaban siswa yang sudah tersimpan untuk soal ini akan ikut terhapus.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    await api.deleteQuestion(roomId, questionId, auth.token);
    refresh();
  }
  async function handleSaveToBank(q) {
    setSavingToBank(q.id);
    try {
      await api.createBankQuestion(
        {
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correct_answer: q.correct_answer,
          word_limit_min: q.word_limit_min,
          word_limit_max: q.word_limit_max,
          points: q.points,
        },
        auth.token
      );
    } finally {
      setSavingToBank(null);
    }
  }
  async function handleAddFromBank(ids) {
    await api.addQuestionsFromBank(roomId, ids, auth.token);
    setShowBankPicker(false);
    refresh();
  }

  async function handleGenerateCode() {
    await api.generateCode(roomId, auth.token);
    refresh();
  }

  function handleStart() {
    socket.emit('exam:start', { roomId });
  }
  async function handleExtend() {
    const raw = await promptDialog({
      title: 'Tambah waktu ujian',
      message: 'Berapa menit tambahan waktu untuk semua siswa di room ini?',
      defaultValue: '5',
      inputType: 'number',
      confirmLabel: 'Tambah',
    });
    if (raw === null) return;
    const minutes = Number(raw);
    if (minutes > 0) socket.emit('exam:extend', { roomId, minutes });
  }
  async function handleEnd() {
    const ok = await confirmDialog({
      title: 'Akhiri ujian sekarang?',
      message: 'Semua siswa akan langsung di-submit paksa, walau belum selesai menjawab.',
      variant: 'danger',
      confirmLabel: 'Akhiri Sekarang',
    });
    if (ok) socket.emit('exam:end', { roomId });
  }
  async function handleDelete() {
    const ok = await confirmDialog({
      title: 'Hapus room ini?',
      message: 'Kode undangan akan hilang. Nilai & log siswa yang sudah ada tetap tersimpan.',
      variant: 'danger',
      confirmLabel: 'Hapus Room',
    });
    if (ok) {
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
          <p className="text-sm text-body">
            {room.duration_minutes} menit · status: {room.status}
            {!isOwner && <span className="ml-2 text-xs font-medium text-primary bg-primary-light rounded-full px-2 py-1">Kamu asisten/pengawas</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && isEditable && (
            <button onClick={handleStart} className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium">
              Mulai Ujian
            </button>
          )}
          {isOwner && room.status === 'in_progress' && (
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
          {isOwner && (
            <button onClick={handleDelete} className="border border-border text-body rounded-md px-4 py-2 text-sm font-medium">
              Hapus Room
            </button>
          )}
        </div>
      </div>

      <section>
        <h2 className="font-medium text-navy mb-3">Pengawas / Asisten</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {assistants.length === 0 && <p className="text-sm text-body">Belum ada asisten ditambahkan.</p>}
          {assistants.map((a) => (
            <div key={a.id} className="flex justify-between items-center text-sm">
              <span>{a.name} <span className="text-body">({a.email})</span></span>
              {isOwner && (
                <button onClick={() => handleRemoveAssistant(a.id)} className="text-danger font-medium">Hapus</button>
              )}
            </div>
          ))}
          {isOwner && (
            <form onSubmit={handleAddAssistant} className="flex gap-2 pt-2 border-t border-border">
              <input
                type="email"
                className="flex-1 border border-border rounded-md px-3 py-2 text-sm"
                placeholder="email lecturer yang mau ditambah"
                value={newAssistantEmail}
                onChange={(e) => setNewAssistantEmail(e.target.value)}
                required
              />
              <button className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium">Tambah</button>
            </form>
          )}
          {assistantError && <p className="text-sm text-danger">{assistantError}</p>}
        </div>
      </section>

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

      {isEditable && isOwner ? (
        <>
          <section>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-medium text-navy">Soal ({questions.length})</h2>
              <button
                onClick={() => setShowBankPicker(true)}
                className="text-sm text-primary font-medium border border-primary rounded-md px-3 py-1.5"
              >
                + Dari Bank Soal
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-card border border-border rounded-lg p-3 text-sm flex justify-between items-center gap-3">
                  <span><span className="text-body">{i + 1}. [{q.type}]</span> {q.prompt}</span>
                  <span className="flex gap-3 shrink-0">
                    <button
                      onClick={() => handleSaveToBank(q)}
                      disabled={savingToBank === q.id}
                      className="text-body font-medium disabled:opacity-40"
                      title="Simpan soal ini ke bank soal supaya bisa dipakai lagi di room lain"
                    >
                      {savingToBank === q.id ? 'Menyimpan…' : 'Simpan ke Bank'}
                    </button>
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

      {showBankPicker && (
        <BankPickerModal token={auth.token} onClose={() => setShowBankPicker(false)} onConfirm={handleAddFromBank} />
      )}
    </div>
  );
}
