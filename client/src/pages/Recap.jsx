import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { RecapSkeleton } from '../components/Skeleton';

export default function Recap() {
  const { roomId } = useParams();
  const { auth } = useAuth();
  const backPath = auth.user.role === 'admin' ? '/admin' : `/lecturer/rooms/${roomId}`;
  const backLabel = auth.user.role === 'admin' ? 'Kembali ke Admin' : 'Kembali ke Room';
  const [data, setData] = useState(null);
  const [openEssay, setOpenEssay] = useState({});
  const [grading, setGrading] = useState({});
  const [exporting, setExporting] = useState(null); 
  const [exportError, setExportError] = useState('');

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

  if (!data) return <RecapSkeleton />;

  async function handleExport(type) {
    setExportError('');
    setExporting(type);
    try {
      const base = data.room.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'room';
      if (type === 'xlsx') await api.exportRecapXlsx(roomId, auth.token, `rekap-${base}.xlsx`);
      else await api.exportRecapPdf(roomId, auth.token, `rekap-${base}.pdf`);
    } catch (err) {
      setExportError(err.message || 'Gagal export');
    } finally {
      setExporting(null);
    }
  }

  const { stats, questionStats } = data;
  const hardestFirst = [...(questionStats || [])].sort(
    (a, b) => (b.wrongCount + b.unansweredCount) - (a.wrongCount + a.unansweredCount)
  );
  const maxBarCount = Math.max(1, ...(stats?.scoreDistribution || []).map((d) => d.count));

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Link to={backPath} className="text-sm text-primary font-medium block mb-4">&larr; {backLabel}</Link>
      <div className="flex justify-between items-start mb-1 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-navy">Rekap — {data.room.title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="border border-border text-body rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {exporting === 'xlsx' ? 'Membuat Excel…' : 'Export Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="border border-border text-body rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {exporting === 'pdf' ? 'Membuat PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>
      {exportError && <p className="text-sm text-danger mb-2">{exportError}</p>}
      <p className="text-sm text-body mb-6">
        Skor dihitung otomatis dari {data.totalScorable} soal pilihan ganda/checkbox
        {data.essayQuestionCount > 0 && ` (di luar ${data.essayQuestionCount} soal essay — essay tidak dinilai otomatis, baca jawabannya di bawah)`}.
      </p>

      {stats && stats.totalParticipants > 0 && (
        <section className="mb-8">
          <h2 className="font-medium text-navy mb-3">Ringkasan Kelas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-body mb-1">Rata-rata</p>
              <p className="text-xl font-semibold text-navy">{stats.averageCorrect.toFixed(1)}<span className="text-sm font-normal text-body">/{data.totalScorable}</span></p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-body mb-1">Tertinggi</p>
              <p className="text-xl font-semibold text-success">{stats.highestCorrect}<span className="text-sm font-normal text-body">/{data.totalScorable}</span></p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-body mb-1">Terendah</p>
              <p className="text-xl font-semibold text-danger">{stats.lowestCorrect}<span className="text-sm font-normal text-body">/{data.totalScorable}</span></p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-body mb-1">Selesai ujian</p>
              <p className="text-xl font-semibold text-navy">{stats.completedCount}<span className="text-sm font-normal text-body">/{stats.totalParticipants}</span></p>
            </div>
          </div>

          {data.totalScorable > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              <p className="text-sm text-body mb-3">Distribusi skor (jumlah siswa per nilai benar)</p>
              <div className="flex items-end gap-2 h-28">
                {stats.scoreDistribution.map((d) => (
                  <div key={d.score} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-xs text-body">{d.count > 0 ? d.count : ''}</span>
                    <div
                      className="w-full bg-primary rounded-t-sm"
                      style={{ height: `${Math.max(4, (d.count / maxBarCount) * 100)}%` }}
                    />
                    <span className="text-xs text-body">{d.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hardestFirst.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-body mb-3">Soal tersulit (paling banyak salah/tidak dijawab)</p>
              <div className="space-y-2">
                {hardestFirst.map((q, i) => {
                  const missed = q.wrongCount + q.unansweredCount;
                  const total = q.correctCount + missed;
                  const pctCorrect = total > 0 ? Math.round((q.correctCount / total) * 100) : 0;
                  return (
                    <div key={q.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-navy">{i + 1}. {q.prompt}</span>
                        <span className="text-body shrink-0">{pctCorrect}% benar</span>
                      </div>
                      <div className="w-full h-1.5 bg-background rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-success" style={{ width: `${pctCorrect}%` }} />
                      </div>
                      <p className="text-xs text-body mt-1">
                        {q.correctCount} benar · {q.wrongCount} salah · {q.unansweredCount} tidak dijawab
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <h2 className="font-medium text-navy mb-3">Per Siswa</h2>
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