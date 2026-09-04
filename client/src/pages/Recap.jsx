import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Recap() {
  const { roomId } = useParams();
  const { auth } = useAuth();
  const [data, setData] = useState(null);
  const [openEssay, setOpenEssay] = useState({});
  const [grading, setGrading] = useState({});

  function refresh() {
    return api.recap(roomId, auth.token).then(setData);
  }
  useEffect(() => { refresh(); }, [roomId]);

  async function handleGrade(answerId, correct) {
    if (!answerId) return;
    setGrading((prev) => ({ ...prev, [answerId]: true }));
    try {
      await api.gradeAnswer(answerId, { is_correct: correct }, auth.token);
      await refresh();
    } finally {
      setGrading((prev) => ({ ...prev, [answerId]: false }));
    }
  }

  if (!data) return <p className="p-8 text-body">Memuat…</p>;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Link to={`/lecturer/rooms/${roomId}`} className="text-sm text-primary font-medium block mb-4">&larr; Kembali ke Room</Link>
      <h1 className="text-2xl font-semibold text-navy mb-1">Rekap — {data.room.title}</h1>
      <p className="text-sm text-body mb-6">
        Skor dihitung otomatis dari {data.totalScorable} soal pilihan ganda/checkbox
        {data.essayQuestionCount > 0 && ` (di luar ${data.essayQuestionCount} soal essay — essay tidak dinilai otomatis, baca jawabannya di bawah)`}.
      </p>

      <div className="space-y-3">
        {data.students.map((s) => (
          <div key={s.session_id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="font-medium text-navy">{s.name}</p>
              <p className="text-sm text-body">{s.correctCount}/{s.totalScorable} benar</p>
            </div>

            {s.violations.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {s.violations.map((v) => (
                  <span key={v.type} className="text-xs bg-danger/10 text-danger px-2 py-1 rounded">
                    {v.type} × {v.count}
                  </span>
                ))}
              </div>
            )}

            {s.essayAnswers.length > 0 && (
              <div>
                <button
                  onClick={() => setOpenEssay((prev) => ({ ...prev, [s.session_id]: !prev[s.session_id] }))}
                  className="text-sm text-primary font-medium"
                >
                  {openEssay[s.session_id] ? 'Sembunyikan' : 'Lihat'} jawaban essay ({s.essayAnswers.length})
                  {s.essayAnswers.some((ea) => ea.answer && !ea.graded) && (
                    <span className="text-warning"> · ada yang belum dinilai</span>
                  )}
                </button>
                {openEssay[s.session_id] && (
                  <div className="mt-2 space-y-2">
                    {s.essayAnswers.map((ea, i) => (
                      <div key={i} className="bg-background border border-border rounded-md p-3 text-sm">
                        <p className="text-body mb-1">{ea.prompt}</p>
                        <p className="text-navy mb-2">{ea.answer || <span className="text-body italic">tidak dijawab</span>}</p>
                        {ea.answer && (
                          <div className="flex items-center gap-3">
                            {ea.graded ? (
                              <span className={`text-xs font-medium px-2 py-1 rounded ${ea.score > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                {ea.score > 0 ? 'Ditandai benar' : 'Ditandai salah'} — sudah dinilai
                              </span>
                            ) : (
                              <span className="text-xs text-warning font-medium">Belum dinilai</span>
                            )}
                            <button
                              disabled={grading[ea.answer_id]}
                              onClick={() => handleGrade(ea.answer_id, true)}
                              className="text-xs text-success font-medium border border-success rounded px-2 py-1 disabled:opacity-40"
                            >
                              Tandai benar
                            </button>
                            <button
                              disabled={grading[ea.answer_id]}
                              onClick={() => handleGrade(ea.answer_id, false)}
                              className="text-xs text-danger font-medium border border-danger rounded px-2 py-1 disabled:opacity-40"
                            >
                              Tandai salah
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {data.students.length === 0 && <p className="text-body text-sm">Belum ada siswa yang ikut room ini.</p>}
      </div>
    </div>
  );
}