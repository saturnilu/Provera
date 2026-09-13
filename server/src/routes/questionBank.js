import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function parseRow(q) {
  return {
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    correct_answer: q.correct_answer !== null ? JSON.parse(q.correct_answer) : null,
  };
}

// Shared validation for both the manual "add one" form and each row of a CSV
// import — keeps the rules (and error wording) in exactly one place.
function validatePayload(body) {
  const { type, prompt, options, correct_answer } = body;
  if (!type || !['essay', 'mcq_single', 'mcq_multi'].includes(type)) {
    return 'Tipe soal harus essay, mcq_single, atau mcq_multi';
  }
  if (!prompt || !String(prompt).trim()) return 'Pertanyaan wajib diisi';

  if (type !== 'essay') {
    const cleanOptions = Array.isArray(options) ? options.filter((o) => String(o || '').trim()) : [];
    if (cleanOptions.length < 2) return 'Minimal 2 opsi jawaban';
    if (type === 'mcq_single') {
      if (typeof correct_answer !== 'number' || correct_answer < 0 || correct_answer >= cleanOptions.length) {
        return 'Jawaban benar tidak valid untuk pilihan ganda';
      }
    } else {
      if (!Array.isArray(correct_answer) || correct_answer.length === 0) return 'Pilih minimal 1 jawaban benar';
      if (correct_answer.some((i) => typeof i !== 'number' || i < 0 || i >= cleanOptions.length)) {
        return 'Jawaban benar tidak valid untuk pilihan ganda';
      }
    }
  }
  return null;
}

function insertBankQuestion(lecturerId, body) {
  const { type, prompt, options, correct_answer, word_limit_min, word_limit_max, points, tag } = body;
  const id = uuid();
  const cleanOptions = type !== 'essay' ? (options || []).filter((o) => String(o || '').trim()) : null;
  db.prepare(
    `INSERT INTO question_bank (id, lecturer_id, type, prompt, options, correct_answer, word_limit_min, word_limit_max, points, tag)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    lecturerId,
    type,
    prompt.trim(),
    cleanOptions ? JSON.stringify(cleanOptions) : null,
    type !== 'essay' ? JSON.stringify(correct_answer) : null,
    type === 'essay' ? (word_limit_min ?? null) : null,
    type === 'essay' ? (word_limit_max ?? null) : null,
    points ?? 1,
    tag ? String(tag).trim() || null : null
  );
  return id;
}

router.get('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const { search, tag } = req.query;
  let rows = db.prepare('SELECT * FROM question_bank WHERE lecturer_id = ? ORDER BY created_at DESC').all(req.user.id);
  if (tag) rows = rows.filter((r) => r.tag === tag);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => r.prompt.toLowerCase().includes(q));
  }
  res.json(rows.map(parseRow));
});

router.get('/tags', requireAuth, requireRole('lecturer'), (req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT tag FROM question_bank WHERE lecturer_id = ? AND tag IS NOT NULL ORDER BY tag")
    .all(req.user.id);
  res.json(rows.map((r) => r.tag));
});

router.post('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });
  const id = insertBankQuestion(req.user.id, req.body);
  res.json({ id });
});

router.put('/:id', requireAuth, requireRole('lecturer'), (req, res) => {
  const existing = db.prepare('SELECT * FROM question_bank WHERE id = ? AND lecturer_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Question not found' });
  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });

  const { type, prompt, options, correct_answer, word_limit_min, word_limit_max, points, tag } = req.body;
  const cleanOptions = type !== 'essay' ? (options || []).filter((o) => String(o || '').trim()) : null;
  db.prepare(
    `UPDATE question_bank SET type=?, prompt=?, options=?, correct_answer=?, word_limit_min=?, word_limit_max=?, points=?, tag=? WHERE id=?`
  ).run(
    type,
    prompt.trim(),
    cleanOptions ? JSON.stringify(cleanOptions) : null,
    type !== 'essay' ? JSON.stringify(correct_answer) : null,
    type === 'essay' ? (word_limit_min ?? null) : null,
    type === 'essay' ? (word_limit_max ?? null) : null,
    points ?? 1,
    tag ? String(tag).trim() || null : null,
    existing.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireRole('lecturer'), (req, res) => {
  const existing = db.prepare('SELECT * FROM question_bank WHERE id = ? AND lecturer_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Question not found' });
  db.prepare('DELETE FROM question_bank WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// Bulk import (from parsed CSV rows, sent as JSON). Every row is validated
// independently and bad rows are skipped and reported instead of failing
// the whole batch — a typo in row 40 shouldn't block the other 39.
router.post('/import', requireAuth, requireRole('lecturer'), (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions harus berupa array dan tidak boleh kosong' });
  }
  if (questions.length > 500) {
    return res.status(400).json({ error: 'Maksimal 500 soal per import' });
  }

  const errors = [];
  let inserted = 0;
  const tx = db.transaction(() => {
    questions.forEach((q, index) => {
      const error = validatePayload(q);
      if (error) {
        errors.push({ row: index + 1, prompt: q.prompt || '(kosong)', error });
        return;
      }
      insertBankQuestion(req.user.id, q);
      inserted += 1;
    });
  });
  tx();

  res.json({ inserted, errors });
});

export default router;
