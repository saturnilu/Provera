import { useEffect, useState } from 'react';

const TYPE_LABELS = {
  essay: 'Essay',
  mcq_single: 'Pilihan Ganda (satu jawaban)',
  mcq_multi: 'Pilihan Ganda (boleh lebih dari satu)',
};

const EMPTY = {
  type: 'mcq_single',
  prompt: '',
  options: ['', ''],
  correctSingle: 0,
  correctMulti: [],
  wordMin: 0,
  wordMax: 200,
  points: 1,
  tag: '',
};
export default function QuestionEditor({ editing, onAdd, onSave, onCancel, showTag = false, showPoints = false }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!editing) { setForm(EMPTY); return; }
    setForm({
      type: editing.type,
      prompt: editing.prompt,
      options: editing.options && editing.options.length ? editing.options : ['', ''],
      correctSingle: editing.type === 'mcq_single' ? (editing.correct_answer ?? 0) : 0,
      correctMulti: editing.type === 'mcq_multi' ? (editing.correct_answer || []) : [],
      wordMin: editing.word_limit_min ?? 0,
      wordMax: editing.word_limit_max ?? 200,
      points: editing.points ?? 1,
      tag: editing.tag || '',
    });
  }, [editing]);

  function updateOption(i, value) {
    const next = [...form.options];
    next[i] = value;
    setForm({ ...form, options: next });
  }

  function removeOption(i) {
    const options = form.options.filter((_, idx) => idx !== i);
    const correctSingle = form.correctSingle === i ? 0 : form.correctSingle > i ? form.correctSingle - 1 : form.correctSingle;
    const correctMulti = form.correctMulti
      .filter((x) => x !== i)
      .map((x) => (x > i ? x - 1 : x));
    setForm({ ...form, options, correctSingle, correctMulti });
  }

  function toggleMulti(i) {
    setForm((f) => ({
      ...f,
      correctMulti: f.correctMulti.includes(i) ? f.correctMulti.filter((x) => x !== i) : [...f.correctMulti, i],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { type: form.type, prompt: form.prompt };
    if (form.type === 'essay') {
      payload.word_limit_min = Number(form.wordMin);
      payload.word_limit_max = Number(form.wordMax);
    } else {
      payload.options = form.options.filter(Boolean);
      payload.correct_answer = form.type === 'mcq_multi' ? form.correctMulti : form.correctSingle;
    }
    if (showPoints) payload.points = Number(form.points) || 1;
    if (showTag) payload.tag = form.tag.trim() || null;
    if (editing) onSave(editing.id, payload);
    else onAdd(payload);
    if (!editing) setForm(EMPTY);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
      {editing && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-primary">Mengedit soal</span>
          <button type="button" onClick={onCancel} className="text-sm text-body">Batal</button>
        </div>
      )}

      <div>
        <label className="block text-sm text-body mb-1">Tipe soal</label>
        <select className="w-full border border-border rounded-md px-3 py-2" value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm text-body mb-1">Pertanyaan</label>
        <textarea className="w-full border border-border rounded-md px-3 py-2" rows={2}
          value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />
      </div>

      {(showTag || showPoints) && (
        <div className="flex gap-3">
          {showTag && (
            <div className="flex-1">
              <label className="block text-sm text-body mb-1">Kategori (opsional)</label>
              <input className="w-full border border-border rounded-md px-3 py-2" value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="mis. Bab 3" />
            </div>
          )}
          {showPoints && (
            <div className="w-28">
              <label className="block text-sm text-body mb-1">Poin</label>
              <input type="number" min="1" className="w-full border border-border rounded-md px-3 py-2"
                value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {form.type === 'essay' && (
        <div className="flex gap-3">
          <div>
            <label className="block text-sm text-body mb-1">Min kata</label>
            <input type="number" min="0" className="w-28 border border-border rounded-md px-3 py-2"
              value={form.wordMin} onChange={(e) => setForm({ ...form, wordMin: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Maks kata</label>
            <input type="number" min="1" className="w-28 border border-border rounded-md px-3 py-2"
              value={form.wordMax} onChange={(e) => setForm({ ...form, wordMax: e.target.value })} />
          </div>
        </div>
      )}

      {(form.type === 'mcq_single' || form.type === 'mcq_multi') && (
        <div className="space-y-2">
          <label className="block text-sm text-body mb-1">Opsi jawaban (tandai yang benar)</label>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={form.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                name="correct"
                checked={form.type === 'mcq_multi' ? form.correctMulti.includes(i) : form.correctSingle === i}
                onChange={() => (form.type === 'mcq_multi' ? toggleMulti(i) : setForm({ ...form, correctSingle: i }))}
              />
              <input className="flex-1 border border-border rounded-md px-3 py-2"
                value={opt} onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opsi ${i + 1}`} required />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={form.options.length <= 2}
                title={form.options.length <= 2 ? 'Minimal 2 opsi' : 'Hapus opsi ini'}
                className="text-danger text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Hapus
              </button>
            </div>
          ))}
          <button type="button" className="text-primary text-sm font-medium"
            onClick={() => setForm({ ...form, options: [...form.options, ''] })}>
            + Tambah opsi
          </button>
        </div>
      )}

      <button className="bg-primary text-white rounded-md px-4 py-2 font-medium">
        {editing ? 'Simpan Perubahan' : 'Tambah Soal'}
      </button>
    </form>
  );
}