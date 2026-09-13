import { useEffect, useState } from 'react';
import { api } from '../api';

const TYPE_LABELS = { essay: 'Essay', mcq_single: 'PG (satu)', mcq_multi: 'PG (multi)' };

export default function BankPickerModal({ token, onClose, onConfirm }) {
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    api.listBankQuestions(token).then(setItems);
  }, [token]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = (items || []).filter((q) => !search || q.prompt.toLowerCase().includes(search.toLowerCase()));

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 transition-all duration-150 max-h-[80vh] flex flex-col ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-2 scale-95'
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-navy">Tambah dari Bank Soal</h3>
          <button onClick={onClose} className="text-body text-sm">Tutup</button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pertanyaan…"
          className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {items === null && <p className="text-body text-sm">Memuat…</p>}
          {items !== null && filtered.length === 0 && (
            <p className="text-body text-sm">
              {items.length === 0 ? 'Bank soal kamu masih kosong. Tambah soal dulu di halaman Bank Soal.' : 'Tidak ada soal yang cocok.'}
            </p>
          )}
          {filtered.map((q) => (
            <label key={q.id} className="flex items-start gap-3 border border-border rounded-lg p-3 cursor-pointer hover:border-primary">
              <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-light text-primary">{TYPE_LABELS[q.type]}</span>
                  {q.tag && <span className="text-xs text-body">{q.tag}</span>}
                </div>
                <p className="text-sm text-navy truncate">{q.prompt}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-body border border-border hover:bg-background">
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className="rounded-md px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? 'Menambahkan…' : `Tambahkan (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
