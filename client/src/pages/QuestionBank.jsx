import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { api } from '../api';
import QuestionEditor from '../components/QuestionEditor';
import { SkeletonBlock } from '../components/Skeleton';

const TYPE_LABELS = { essay: 'Essay', mcq_single: 'PG (satu)', mcq_multi: 'PG (multi)' };

const CSV_TEMPLATE = `type,prompt,options,correct_answer,points,word_limit_min,word_limit_max,tag
mcq_single,Ibukota Indonesia?,Jakarta|Surabaya|Bandung,Jakarta,1,,,Geografi
mcq_multi,Pilih bilangan prima,2|3|4|5,0;1,2,,,Matematika
essay,Jelaskan proses fotosintesis,,,2,20,150,Biologi
`;

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-bank-soal.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function resolveOptionIndex(options, token) {
  const t = (token || '').trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const idx = options.findIndex((o) => o.toLowerCase() === t.toLowerCase());
  return idx >= 0 ? idx : null;
}

// Turn one parsed CSV row into the same payload shape the manual form sends.
// Validation itself happens server-side (one source of truth), so this stays
// a plain, forgiving mapping — bad rows just come back flagged in the result.
function csvRowToQuestion(row) {
  const type = (row.type || '').trim();
  const prompt = (row.prompt || '').trim();
  const tag = (row.tag || '').trim() || undefined;
  const points = row.points ? Number(row.points) : 1;

  if (type === 'essay') {
    return {
      type,
      prompt,
      word_limit_min: row.word_limit_min ? Number(row.word_limit_min) : 0,
      word_limit_max: row.word_limit_max ? Number(row.word_limit_max) : 200,
      points,
      tag,
    };
  }

  const options = (row.options || '').split('|').map((s) => s.trim()).filter(Boolean);
  const rawCorrect = (row.correct_answer || '').trim();
  const correct_answer =
    type === 'mcq_multi'
      ? rawCorrect.split(';').map((t) => resolveOptionIndex(options, t)).filter((x) => x !== null)
      : resolveOptionIndex(options, rawCorrect);

  return { type, prompt, options, correct_answer, points, tag };
}

export default function QuestionBank() {
  const { auth } = useAuth();
  const { confirmDialog } = useModal();

  const [items, setItems] = useState(null);
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [importPreview, setImportPreview] = useState(null); // parsed rows before sending
  const [importResult, setImportResult] = useState(null); // { inserted, errors }
  const [importing, setImporting] = useState(false);

  async function refresh() {
    const [list, tagList] = await Promise.all([
      api.listBankQuestions(auth.token, { search: search || undefined, tag: tagFilter !== 'all' ? tagFilter : undefined }),
      api.listBankTags(auth.token),
    ]);
    setItems(list);
    setTags(tagList);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter]);

  // Debounced-ish: refetch on search without hammering the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => refresh(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAdd(payload) {
    setError('');
    try {
      await api.createBankQuestion(payload, auth.token);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveEdit(id, payload) {
    setError('');
    try {
      await api.updateBankQuestion(id, payload, auth.token);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(q) {
    const ok = await confirmDialog({
      title: 'Hapus soal dari bank?',
      message: 'Soal ini akan dihapus dari bank. Soal yang sudah dipakai di room tidak ikut terhapus.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    setBusyId(q.id);
    try {
      await api.deleteBankQuestion(q.id, auth.token);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map(csvRowToQuestion);
        setImportPreview(rows);
        setImportResult(null);
      },
      error: (err) => setError(`Gagal membaca CSV: ${err.message}`),
    });
    e.target.value = '';
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const result = await api.importBankQuestions(importPreview, auth.token);
      setImportResult(result);
      setImportPreview(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const filteredCount = items?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy mb-1">Bank Soal</h1>
        <p className="text-sm text-body">
          Simpan soal di sini sekali, lalu pakai berkali-kali lewat tombol "Dari Bank Soal" di halaman room.
        </p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-navy">Import dari CSV</h2>
          <button onClick={downloadCsvTemplate} className="text-sm text-primary font-medium">
            Unduh Template
          </button>
        </div>
        <p className="text-sm text-body mb-3">
          Kolom: <code className="text-xs bg-background px-1 py-0.5 rounded">type, prompt, options, correct_answer, points, word_limit_min, word_limit_max, tag</code>.
          Untuk <code className="text-xs bg-background px-1 py-0.5 rounded">options</code> pisahkan pakai <code>|</code>, dan{' '}
          <code className="text-xs bg-background px-1 py-0.5 rounded">correct_answer</code> boleh diisi teks jawabannya langsung
          (atau nomor urut mulai 0). Untuk pilihan-ganda-multi, pisahkan beberapa jawaban benar pakai <code>;</code>.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="text-sm text-body file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary-light file:text-primary file:font-medium file:cursor-pointer"
        />

        {importPreview && (
          <div className="mt-4 border border-border rounded-lg overflow-hidden">
            <div className="bg-background px-3 py-2 text-sm text-body flex justify-between items-center">
              <span>{importPreview.length} baris terbaca dari file. Cek dulu sebelum diimpor.</span>
              <div className="flex gap-2">
                <button onClick={() => setImportPreview(null)} className="text-sm text-body">Batal</button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="bg-primary text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {importing ? 'Mengimpor…' : `Impor ${importPreview.length} Soal`}
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-border">
              {importPreview.map((q, i) => (
                <div key={i} className="px-3 py-2 text-sm flex gap-2">
                  <span className="text-body w-6 shrink-0">{i + 1}.</span>
                  <span className="text-navy">{q.prompt || <em className="text-danger">kosong</em>}</span>
                  <span className="text-body ml-auto shrink-0">{TYPE_LABELS[q.type] || q.type || '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {importResult && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-success font-medium">{importResult.inserted} soal berhasil ditambahkan ke bank.</p>
            {importResult.errors.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm">
                <p className="text-warning font-medium mb-1">{importResult.errors.length} baris dilewati:</p>
                <ul className="text-body space-y-0.5">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>
                      Baris {e.row} ({e.prompt}): {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium text-navy">Semua Soal ({filteredCount})</h2>
          <div className="flex gap-2">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm text-navy bg-card"
            >
              <option value="all">Semua kategori</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pertanyaan…"
              className="border border-border rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => { setEditing(null); setShowForm((s) => !s); }}
              className="bg-primary text-white rounded-md px-3 py-1.5 text-sm font-medium"
            >
              {showForm ? 'Tutup' : '+ Tambah Manual'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4">
            <QuestionEditor onAdd={handleAdd} showTag showPoints />
          </div>
        )}

        {items === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((q) =>
              editing?.id === q.id ? (
                <QuestionEditor key={q.id} editing={editing} onSave={handleSaveEdit} onCancel={() => setEditing(null)} showTag showPoints />
              ) : (
                <div key={q.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-light text-primary">{TYPE_LABELS[q.type]}</span>
                      <span className="text-xs text-body">{q.points} poin</span>
                      {q.tag && <span className="text-xs font-medium px-2 py-0.5 rounded bg-background text-body">{q.tag}</span>}
                    </div>
                    <p className="text-sm text-navy truncate">{q.prompt}</p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => { setShowForm(false); setEditing(q); }} className="text-primary font-medium text-sm">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(q)}
                      disabled={busyId === q.id}
                      className="text-danger font-medium text-sm disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )
            )}
            {items.length === 0 && (
              <p className="text-body text-sm py-6 text-center">
                Belum ada soal di bank. Tambah manual atau import dari CSV di atas.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
