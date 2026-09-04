import db from './db.js';

export function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('room:join', ({ roomId, role }) => {
      socket.join(`room:${roomId}`);
      if (role === 'lecturer') socket.join(`room:${roomId}:lecturer`);
    });

    socket.on('exam:start', ({ roomId }) => {
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
      if (!room) return;
      db.prepare("UPDATE rooms SET status = 'in_progress', started_at = datetime('now') WHERE id = ?").run(roomId);
      db.prepare("UPDATE room_sessions SET status = 'in_progress', exam_started_at = datetime('now') WHERE room_id = ? AND status = 'waiting'").run(roomId);
      io.to(`room:${roomId}`).emit('exam:start', { durationMinutes: room.duration_minutes });
    });

    socket.on('exam:extend', ({ roomId, minutes }) => {
      db.prepare('UPDATE rooms SET extended_minutes = extended_minutes + ? WHERE id = ?').run(minutes, roomId);
      io.to(`room:${roomId}`).emit('exam:extend', { minutes });
    });

    socket.on('exam:end', ({ roomId }) => {
      db.prepare("UPDATE rooms SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(roomId);
      io.to(`room:${roomId}`).emit('exam:end_now');
    });

    socket.on('violation:report', ({ roomId, studentName, type, timestamp }) => {
      io.to(`room:${roomId}:lecturer`).emit('violation:live', { studentName, type, timestamp });
    });

    socket.on('exam:student_completed', ({ roomId, studentName }) => {
      io.to(`room:${roomId}:lecturer`).emit('exam:student_completed', { studentName });
    });
  });
}