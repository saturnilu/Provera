import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function withStats(course) {
  const rooms = db
    .prepare("SELECT id, status FROM rooms WHERE course_id = ? AND status != 'deleted'")
    .all(course.id);
  const lastRoom = db
    .prepare("SELECT created_at FROM rooms WHERE course_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT 1")
    .get(course.id);
  return {
    ...course,
    roomCount: rooms.length,
    endedCount: rooms.filter((r) => r.status === 'ended').length,
    lastActivityAt: lastRoom ? lastRoom.created_at : null,
  };
}

router.get('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM courses WHERE lecturer_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(rows.map(withStats));
});

router.post('/', requireAuth, requireRole('lecturer'), (req, res) => {
  const { name, code } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama mata kuliah wajib diisi' });
  const id = uuid();
  db.prepare('INSERT INTO courses (id, lecturer_id, name, code) VALUES (?,?,?,?)')
    .run(id, req.user.id, name.trim(), (code || '').trim() || null);
  res.json({ id });
});

router.put('/:id', requireAuth, requireRole('lecturer'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND lecturer_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const { name, code } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama mata kuliah wajib diisi' });
  db.prepare('UPDATE courses SET name = ?, code = ? WHERE id = ?').run(name.trim(), (code || '').trim() || null, course.id);
  res.json({ ok: true });
});

// Deleting a course never deletes its rooms/grades — it just un-groups them
// (course_id set back to NULL) so exam history and scores are never lost.
router.delete('/:id', requireAuth, requireRole('lecturer'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND lecturer_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  db.prepare('UPDATE rooms SET course_id = NULL WHERE course_id = ?').run(course.id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
  res.json({ ok: true });
});

router.get('/:id', requireAuth, requireRole('lecturer'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND lecturer_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const rooms = db
    .prepare(
      `SELECT r.id, r.title, r.status, r.duration_minutes, r.created_at,
              (SELECT COUNT(*) FROM room_sessions rs WHERE rs.room_id = r.id) as participant_count,
              (SELECT COUNT(*) FROM room_sessions rs WHERE rs.room_id = r.id AND rs.status = 'completed') as completed_count
       FROM rooms r
       WHERE r.course_id = ? AND r.status != 'deleted'
       ORDER BY r.created_at DESC`
    )
    .all(course.id);

  res.json({ course, rooms });
});

export default router;
