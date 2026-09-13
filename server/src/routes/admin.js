import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/stats', requireAuth, requireRole('admin'), (req, res) => {
  const roleCounts = db.prepare('SELECT role, COUNT(*) as c FROM users GROUP BY role').all();
  const byRole = Object.fromEntries(roleCounts.map((r) => [r.role, r.c]));

  const statusCounts = db.prepare("SELECT status, COUNT(*) as c FROM rooms WHERE status != 'deleted' GROUP BY status").all();
  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.c]));
  const totalRooms = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE status != 'deleted'").get().c;

  res.json({
    admins: byRole.admin || 0,
    lecturers: byRole.lecturer || 0,
    students: byRole.student || 0,
    totalRooms,
    roomsByStatus: byStatus,
  });
});

router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.query;
  const rows =
    role && ['admin', 'lecturer', 'student'].includes(role)
      ? db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE role = ? ORDER BY created_at DESC').all(role)
      : db.prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC').all();

  const withActivity = rows.map((u) => {
    if (u.role === 'lecturer') {
      const roomCount = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE lecturer_id = ? AND status != 'deleted'").get(u.id).c;
      return { ...u, roomCount };
    }
    if (u.role === 'student') {
      const sessionCount = db.prepare('SELECT COUNT(*) as c FROM room_sessions WHERE student_id = ?').get(u.id).c;
      return { ...u, sessionCount };
    }
    return u;
  });

  res.json(withActivity);
});

router.delete('/users/:userId', requireAuth, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Akun admin tidak bisa dinonaktifkan dari sini.' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });

  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.id);
  res.json({ ok: true, deactivated: true });
});

router.post('/users/:userId/reactivate', requireAuth, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.id);
  res.json({ ok: true, deactivated: false });
});

router.get('/rooms', requireAuth, requireRole('admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.title, r.status, r.duration_minutes, r.max_participants, r.created_at,
              u.name as lecturer_name, u.email as lecturer_email,
              (SELECT COUNT(*) FROM room_sessions rs WHERE rs.room_id = r.id) as participant_count
       FROM rooms r JOIN users u ON u.id = r.lecturer_id
       WHERE r.status != 'deleted'
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.delete('/rooms/:roomId', requireAuth, requireRole('admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  db.prepare("UPDATE rooms SET status = 'deleted', join_code = NULL WHERE id = ?").run(room.id);
  res.json({ ok: true });
});

export default router;