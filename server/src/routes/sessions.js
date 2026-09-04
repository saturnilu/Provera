import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/:sessionId/answers', requireAuth, requireRole('student'), (req, res) => {
  const session = db.prepare('SELECT * FROM room_sessions WHERE id = ? AND student_id = ?').get(req.params.sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { question_id, answer_value } = req.body;
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  let is_correct = null;
  let score = 0;

  if (question.type !== 'essay') {
    const correct = question.correct_answer ? JSON.parse(question.correct_answer) : null;
    const given = answer_value;
    if (question.type === 'mcq_multi') {
      const a = Array.isArray(correct) ? [...correct].sort() : [];
      const b = Array.isArray(given) ? [...given].sort() : [];
      is_correct = JSON.stringify(a) === JSON.stringify(b) ? 1 : 0;
    } else {
      is_correct = JSON.stringify(correct) === JSON.stringify(given) ? 1 : 0;
    }
    score = is_correct;
  }

  const existing = db.prepare('SELECT id FROM answers WHERE room_session_id = ? AND question_id = ?').get(session.id, question_id);
  if (existing) {
    db.prepare('UPDATE answers SET answer_value = ?, is_correct = ?, score = ? WHERE id = ?')
      .run(JSON.stringify(answer_value), is_correct, score, existing.id);
  } else {
    db.prepare('INSERT INTO answers (id, room_session_id, question_id, answer_value, is_correct, score) VALUES (?,?,?,?,?,?)')
      .run(uuid(), session.id, question_id, JSON.stringify(answer_value), is_correct, score);
  }
  res.json({ ok: true });
});

router.post('/:sessionId/complete', requireAuth, requireRole('student'), (req, res) => {
  const session = db.prepare('SELECT * FROM room_sessions WHERE id = ? AND student_id = ?').get(req.params.sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (!req.body.force) {
    const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM questions WHERE room_id = ?').get(session.room_id).c;
    const answeredCount = db.prepare('SELECT COUNT(*) as c FROM answers WHERE room_session_id = ?').get(session.id).c;
    if (answeredCount < totalQuestions) {
      return res.status(400).json({ error: `Please answer all questions first (${answeredCount}/${totalQuestions} answered)` });
    }
  }

  const total = db.prepare('SELECT COALESCE(SUM(score), 0) as t FROM answers WHERE room_session_id = ?').get(session.id).t;
  db.prepare(`UPDATE room_sessions SET status = 'completed', exam_ended_at = datetime('now'), total_score = ? WHERE id = ?`)
    .run(total, session.id);
  res.json({ ok: true, total_score: total });
});

router.post('/:sessionId/violations', requireAuth, requireRole('student'), (req, res) => {
  const session = db.prepare('SELECT * FROM room_sessions WHERE id = ? AND student_id = ?').get(req.params.sessionId, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { type, duration_seconds } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO violation_logs (id, room_session_id, type, duration_seconds) VALUES (?,?,?,?)')
    .run(id, session.id, type, duration_seconds || 0);
  res.json({ ok: true, id });
});

export default router;