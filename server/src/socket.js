import jwt from 'jsonwebtoken';
import db from './db.js';

function isOwnerOfRoom(socket, roomId) {
  if (socket.user.role !== 'lecturer') return null;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  return room && room.lecturer_id === socket.user.id ? room : null;
}

function canMonitorRoom(socket, roomId) {
  const room = isOwnerOfRoom(socket, roomId);
  if (room) return room;
  if (socket.user.role !== 'lecturer') return null;
  const fullRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!fullRoom) return null;
  const assisting = db.prepare('SELECT 1 FROM room_assistants WHERE room_id = ? AND user_id = ?').get(roomId, socket.user.id);
  return assisting ? fullRoom : null;
}

function isParticipant(socket, roomId) {
  if (socket.user.role !== 'student') return false;
  return !!db.prepare('SELECT 1 FROM room_sessions WHERE room_id = ? AND student_id = ?').get(roomId, socket.user.id);
}

export function attachSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(payload.id);
      if (!user || !user.is_active) return next(new Error('This account has been deactivated'));
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:join', ({ roomId }) => {
      if (canMonitorRoom(socket, roomId)) {
        socket.join(`room:${roomId}`);
        socket.join(`room:${roomId}:lecturer`);
      } else if (isParticipant(socket, roomId)) {
        socket.join(`room:${roomId}`);
      }
    });

    socket.on('exam:start', ({ roomId }) => {
      const room = isOwnerOfRoom(socket, roomId);
      if (!room) return;
      db.prepare("UPDATE rooms SET status = 'in_progress', started_at = datetime('now') WHERE id = ?").run(roomId);
      db.prepare("UPDATE room_sessions SET status = 'in_progress', exam_started_at = datetime('now') WHERE room_id = ? AND status = 'waiting'").run(roomId);
      io.to(`room:${roomId}`).emit('exam:start', { durationMinutes: room.duration_minutes });
    });

    socket.on('exam:extend', ({ roomId, minutes }) => {
      if (!isOwnerOfRoom(socket, roomId)) return;
      const mins = Number(minutes);
      if (!Number.isFinite(mins) || mins <= 0) return;
      db.prepare('UPDATE rooms SET extended_minutes = extended_minutes + ? WHERE id = ?').run(mins, roomId);
      io.to(`room:${roomId}`).emit('exam:extend', { minutes: mins });
    });

    socket.on('exam:end', ({ roomId }) => {
      if (!isOwnerOfRoom(socket, roomId)) return;
      db.prepare("UPDATE rooms SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(roomId);
      io.to(`room:${roomId}`).emit('exam:end_now');
    });

    socket.on('violation:report', ({ roomId, type, timestamp }) => {
      if (!isParticipant(socket, roomId)) return;
      io.to(`room:${roomId}:lecturer`).emit('violation:live', { studentName: socket.user.name, type, timestamp });
    });

    socket.on('exam:student_completed', ({ roomId }) => {
      if (!isParticipant(socket, roomId)) return;
      io.to(`room:${roomId}:lecturer`).emit('exam:student_completed', { studentName: socket.user.name });
    });
  });
}