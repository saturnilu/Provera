import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { socket } from '../socket';
import FaceMonitor from '../components/FaceMonitor';

function isAnswered(q, value) {
  if (value === undefined || value === null) return false;
  if (q.type === 'essay') return String(value).trim().length > 0;
  if (q.type === 'mcq_multi') return Array.isArray(value) && value.length > 0;
  return value !== ''; 
}

export default function StudentExam() {
  const { roomId } = useParams();
  const { auth } = useAuth();

  const [exam, setExam] = useState(null);
  const [phase, setPhase] = useState('loading'); 
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answers, setAnswers] = useState({}); 
  const [submitError, setSubmitError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    api.getExam(roomId, auth.token).then((data) => {
      setExam(data);
      setAnswers(data.priorAnswers || {});
      if (data.room.status === 'in_progress') {
        setPhase('in_progress');
        setSecondsLeft(data.secondsLeft ?? data.room.duration_minutes * 60);
      } else if (data.room.status === 'ended') {
        setPhase('submitted');
      } else {
        setPhase('waiting');
      }
    });
    socket.emit('room:join', { roomId, role: 'student' });
  }, [roomId]);

  useEffect(() => {
    const onStart = ({ durationMinutes }) => {
      setSecondsLeft(durationMinutes * 60);
      setPhase('in_progress');
    };
    const onExtend = ({ minutes }) => setSecondsLeft((s) => s + minutes * 60);
    const onEndNow = () => handleSubmit(true);

    socket.on('exam:start', onStart);
    socket.on('exam:extend', onExtend);
    socket.on('exam:end_now', onEndNow);
    return () => {
      socket.off('exam:start', onStart);
      socket.off('exam:extend', onExtend);
      socket.off('exam:end_now', onEndNow);
    };
  }, [exam]);

  useEffect(() => {
    if (phase !== 'in_progress') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  async function saveAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSubmitError('');
    if (exam) await api.submitAnswer(exam.session.id, { question_id: questionId, answer_value: value }, auth.token);
  }

  function handleViolation({ type }) {
    if (!exam || phase !== 'in_progress') return;
    api.reportViolation(exam.session.id, { type }, auth.token).catch(() => {});
    socket.emit('violation:report', {
      roomId, studentName: auth.user.name, type, timestamp: new Date().toISOString(),
    });
  }

  async function handleSubmit(force = false) {
    if (!exam || phase === 'submitted') return;
    try {
      await api.completeSession(exam.session.id, { force }, auth.token);
      clearInterval(timerRef.current);
      socket.emit('exam:student_completed', { roomId, studentName: auth.user.name });
      setPhase('submitted');
    } catch (err) {
      if (force) {
        clearInterval(timerRef.current);
        setPhase('submitted');
      } else {
        setSubmitError(err.message);
      }
    }
  }

  if (phase === 'loading' || !exam) return <p className="p-8 text-body">Memuat…</p>;

  if (phase === 'waiting') {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <Link to="/student" className="text-sm text-primary font-medium block mb-6">&larr; Kembali ke Dashboard</Link>
        <h1 className="text-xl font-semibold text-navy mb-2">{exam.room.title}</h1>
        <p className="text-body">Menunggu lecturer memulai ujian…</p>
      </div>
    );
  }

  if (phase === 'submitted') {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <h1 className="text-xl font-semibold text-navy mb-2">Ujian Selesai</h1>
        <p className="text-body mb-6">Jawaban kamu sudah tersimpan. Terima kasih!</p>
        <Link to="/student" className="text-primary font-medium">Kembali ke Dashboard</Link>
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const answeredCount = exam.questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const allAnswered = answeredCount === exam.questions.length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-navy">{exam.room.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-body">{answeredCount}/{exam.questions.length} terjawab</span>
          <span className="font-mono text-lg text-navy bg-primary-light px-3 py-1 rounded-md">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <FaceMonitor referenceEmbedding={exam.referenceEmbedding} onViolation={handleViolation} />
          {!exam.referenceEmbedding && (
            <p className="text-xs text-danger mt-2">
              Wajah kamu belum terdaftar — hubungi lecturer/admin sebelum ujian.
            </p>
          )}
        </div>

        <div className="col-span-2 space-y-4">
          {exam.questions.map((q, i) => {
            const answered = isAnswered(q, answers[q.id]);
            return (
              <div key={q.id} className={`bg-card border rounded-xl p-4 ${answered ? 'border-border' : 'border-warning'}`}>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm text-body">Soal {i + 1}</p>
                  {!answered && <span className="text-xs text-warning font-medium">Belum dijawab</span>}
                </div>
                <p className="text-navy font-medium mb-3">{q.prompt}</p>

                {q.type === 'essay' && (
                  <textarea
                    className="w-full border border-border rounded-md px-3 py-2"
                    rows={4}
                    value={answers[q.id] || ''}
                    placeholder={`${q.word_limit_min || 0}-${q.word_limit_max || '?'} kata`}
                    onChange={(e) => saveAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'mcq_single' && q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 py-1 text-sm">
                    <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => saveAnswer(q.id, oi)} />
                    {opt}
                  </label>
                ))}

                {q.type === 'mcq_multi' && q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={(answers[q.id] || []).includes(oi)} onChange={() => {
                      const current = answers[q.id] || [];
                      const next = current.includes(oi) ? current.filter((x) => x !== oi) : [...current, oi];
                      saveAnswer(q.id, next);
                    }} />
                    {opt}
                  </label>
                ))}
              </div>
            );
          })}

          {submitError && <p className="text-sm text-danger">{submitError}</p>}
          <button
            onClick={() => handleSubmit(false)}
            disabled={!allAnswered}
            className="w-full bg-primary text-white rounded-md py-3 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allAnswered ? 'Submit Ujian' : `Jawab semua soal dulu (${answeredCount}/${exam.questions.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}