import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function parseQuestion(q) {
  return {
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    correct_answer: q.correct_answer !== null ? JSON.parse(q.correct_answer) : null,
  };
}

router.post('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const { title, duration_minutes } = req.body;
  if (!title || !duration_minutes) return res.status(400).json({ error: 'title and duration_minutes are required' });
  const id = uuid();
  db.prepare('INSERT INTO rooms (id, lecturer_id, title, duration_minutes, status) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, title, duration_minutes, 'draft');
  res.json({ id, title, duration_minutes, status: 'draft' });
});

router.get('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const rooms = db.prepare("SELECT * FROM rooms WHERE lecturer_id = ? AND status != 'deleted' ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(rooms);
});

router.post('/:roomId/questions', requireAuth, requireRole('lecturer'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(req.params.roomId, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { type, prompt, options, correct_answer, word_limit_min, word_limit_max, points } = req.body;
  if (!type || !prompt) return res.status(400).json({ error: 'type and prompt are required' });

  const id = uuid();
  const orderRow = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM questions WHERE room_id = ?').get(room.id);
  db.prepare(`INSERT INTO questions (id, room_id, type, prompt, options, correct_answer, word_limit_min, word_limit_max, points, order_index)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, room.id, type, prompt,
      options ? JSON.stringify(options) : null,
      correct_answer !== undefined ? JSON.stringify(correct_answer) : null,
      word_limit_min ?? null, word_limit_max ?? null,
      points ?? 1, orderRow.m + 1);
  res.json({ id });
});

router.put('/:roomId/questions/:questionId', requireAuth, requireRole('lecturer'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(req.params.roomId, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const question = db.prepare('SELECT * FROM questions WHERE id = ? AND room_id = ?').get(req.params.questionId, room.id);
  if (!question) return res.status(404).json({ error: 'Question not found' });

  const { type, prompt, options, correct_answer, word_limit_min, word_limit_max, points } = req.body;
  db.prepare(`UPDATE questions SET type=?, prompt=?, options=?, correct_answer=?, word_limit_min=?, word_limit_max=?, points=? WHERE id=?`)
    .run(type, prompt,
      options ? JSON.stringify(options) : null,
      correct_answer !== undefined ? JSON.stringify(correct_answer) : null,
      word_limit_min ?? null, word_limit_max ?? null,
      points ?? 1, question.id);
  res.json({ ok: true });
});

router.delete('/:roomId/questions/:questionId', requireAuth, requireRole('lecturer'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(req.params.roomId, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  db.prepare('DELETE FROM questions WHERE id = ? AND room_id = ?').run(req.params.questionId, room.id);
  db.prepare('DELETE FROM answers WHERE question_id = ?').run(req.params.questionId);
  res.json({ ok: true });
});

router.post('/:roomId/generate-code', requireAuth, requireRole('lecturer'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(req.params.roomId, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  let code = genCode();
  while (db.prepare('SELECT 1 FROM rooms WHERE join_code = ?').get(code)) code = genCode();
  db.prepare('UPDATE rooms SET join_code = ? WHERE id = ?').run(code, room.id);
  res.json({ code });
});

router.get('/:roomId', requireAuth, requireRole('lecturer', 'admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (req.user.role === 'lecturer' && room.lecturer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const questions = db.prepare('SELECT * FROM questions WHERE room_id = ? ORDER BY order_index').all(room.id).map(parseQuestion);
  const participants = db.prepare(`
    SELECT rs.id as session_id, rs.status, rs.total_score, u.name, u.id as student_id
    FROM room_sessions rs JOIN users u ON u.id = rs.student_id
    WHERE rs.room_id = ?`).all(room.id);

  res.json({ room, questions, participants });
});

router.post('/join', requireAuth, requireRole('student'), (req, res) => {
  const { code } = req.body;
  const room = db.prepare('SELECT * FROM rooms WHERE join_code = ?').get((code || '').toUpperCase());
  if (!room || room.status === 'deleted') return res.status(404).json({ error: 'Invalid code' });
  if (room.status === 'ended') return res.status(409).json({ error: 'This exam has already ended' });

  const hasFace = db.prepare('SELECT 1 FROM face_embeddings WHERE user_id = ?').get(req.user.id);
  if (!hasFace) {
    return res.status(403).json({ error: 'FACE_NOT_ENROLLED', message: 'Please enroll your face before joining a room' });
  }

  const already = db.prepare('SELECT * FROM room_sessions WHERE room_id = ? AND student_id = ?').get(room.id, req.user.id);
  if (!already) {
    const count = db.prepare('SELECT COUNT(*) as c FROM room_sessions WHERE room_id = ?').get(room.id).c;
    if (count >= room.max_participants) {
      return res.status(409).json({ error: `Room is full (max ${room.max_participants} students)` });
    }
    const sessionId = uuid();
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO room_sessions (id, room_id, student_id, status) VALUES (?,?,?,?)')
        .run(sessionId, room.id, req.user.id, 'waiting');
      if (room.status === 'draft') db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ?").run(room.id);
    });
    tx();
  }

  const session = db.prepare('SELECT * FROM room_sessions WHERE room_id = ? AND student_id = ?').get(room.id, req.user.id);
  res.json({ room, session });
});

router.get('/:roomId/exam', requireAuth, requireRole('student'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
  const session = db.prepare('SELECT * FROM room_sessions WHERE room_id = ? AND student_id = ?').get(req.params.roomId, req.user.id);
  if (!room || !session) return res.status(404).json({ error: 'Not joined to this room' });

  const embeddingRow = db.prepare('SELECT embedding FROM face_embeddings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);
  const questions = db.prepare('SELECT id, type, prompt, options, word_limit_min, word_limit_max, points FROM questions WHERE room_id = ? ORDER BY order_index').all(room.id);
  const priorAnswers = db.prepare('SELECT question_id, answer_value FROM answers WHERE room_session_id = ?').all(session.id);

  let secondsLeft = null;
  if (room.status === 'in_progress' && room.started_at) {
    const totalSeconds = (room.duration_minutes + room.extended_minutes) * 60;
    const elapsed = (Date.now() - new Date(room.started_at + 'Z').getTime()) / 1000;
    secondsLeft = Math.max(0, Math.round(totalSeconds - elapsed));
  }

  res.json({
    room,
    session,
    secondsLeft,
    referenceEmbedding: embeddingRow ? JSON.parse(embeddingRow.embedding) : null,
    questions: questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null })),
    priorAnswers: Object.fromEntries(priorAnswers.map(a => [a.question_id, JSON.parse(a.answer_value)])),
  });
});

router.get('/:roomId/recap', requireAuth, requireRole('lecturer', 'admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (req.user.role === 'lecturer' && room.lecturer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const totalScorable = db.prepare("SELECT COUNT(*) as c FROM questions WHERE room_id = ? AND type != 'essay'").get(room.id).c;
  const essayQuestions = db.prepare("SELECT id, prompt, points FROM questions WHERE room_id = ? AND type = 'essay' ORDER BY order_index").all(room.id);

  const students = db.prepare(`
    SELECT rs.id as session_id, u.name, u.id as student_id, rs.status
    FROM room_sessions rs JOIN users u ON u.id = rs.student_id
    WHERE rs.room_id = ?`).all(room.id);

  const result = students.map(s => {
    const correctCount = db.prepare(`
      SELECT COUNT(*) as c FROM answers a
      JOIN questions q ON q.id = a.question_id
      WHERE a.room_session_id = ? AND a.is_correct = 1 AND q.type != 'essay'`).get(s.session_id).c;
    const violations = db.prepare(`
      SELECT type, COUNT(*) as count FROM violation_logs WHERE room_session_id = ? GROUP BY type`).all(s.session_id);
    const essayAnswers = essayQuestions.map(q => {
      const a = db.prepare('SELECT id, answer_value, is_correct, score, graded_at FROM answers WHERE room_session_id = ? AND question_id = ?').get(s.session_id, q.id);
      return {
        answer_id: a ? a.id : null,
        prompt: q.prompt,
        points: q.points,
        answer: a ? JSON.parse(a.answer_value) : null,
        graded: a ? a.graded_at !== null : false,
        score: a ? a.score : 0,
      };
    });
    return { ...s, correctCount, totalScorable, violations, essayAnswers };
  });

  res.json({ room, totalScorable, essayQuestionCount: essayQuestions.length, students: result });
});

router.post('/answers/:answerId/grade', requireAuth, requireRole('lecturer'), (req, res) => {
  const answer = db.prepare(`
    SELECT a.*, q.room_id, q.type, q.points FROM answers a
    JOIN questions q ON q.id = a.question_id
    WHERE a.id = ?`).get(req.params.answerId);
  if (!answer) return res.status(404).json({ error: 'Answer not found' });
  if (answer.type !== 'essay') return res.status(400).json({ error: 'Only essay answers can be manually graded' });

  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(answer.room_id, req.user.id);
  if (!room) return res.status(403).json({ error: 'Forbidden' });

  const { score, is_correct } = req.body;
  const finalScore = score !== undefined ? Number(score) : (is_correct ? answer.points : 0);
  if (Number.isNaN(finalScore) || finalScore < 0) {
    return res.status(400).json({ error: 'score must be a non-negative number' });
  }

  db.prepare(`UPDATE answers SET score = ?, is_correct = ?, graded_by = ?, graded_at = datetime('now') WHERE id = ?`)
    .run(finalScore, is_correct ? 1 : 0, req.user.id, answer.id);

  const sessionTotal = db.prepare('SELECT COALESCE(SUM(score), 0) as t FROM answers WHERE room_session_id = ?').get(answer.room_session_id).t;
  db.prepare('UPDATE room_sessions SET total_score = ? WHERE id = ?').run(sessionTotal, answer.room_session_id);

  res.json({ ok: true, score: finalScore, total_score: sessionTotal });
});

router.delete('/:roomId', requireAuth, requireRole('lecturer'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND lecturer_id = ?').get(req.params.roomId, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  db.prepare("UPDATE rooms SET status = 'deleted', join_code = NULL WHERE id = ?").run(room.id);
  res.json({ ok: true });
});

export default router;