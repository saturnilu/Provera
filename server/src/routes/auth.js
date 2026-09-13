import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter, authLimiter } from '../middleware/rateLimit.js';

const router = Router();
const RESET_TOKEN_TTL_MINUTES = 30;

router.post('/register', authLimiter, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['lecturer', 'student'].includes(role)) {
    return res.status(400).json({ error: 'name, email, password, and a valid role are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuid();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(id, name, email, password_hash, role);

  const token = jwt.sign({ id, name, role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id, name, email, role } });
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: 'Akun ini sudah dinonaktifkan oleh admin. Hubungi admin jika ini keliru.' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.put('/me', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user });
});

router.put('/me/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const password_hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
  res.json({ ok: true });
});

router.post('/forgot-password', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const genericResponse = { ok: true, message: 'Kalau email ini terdaftar, link reset password sudah dibuat.' };
  if (!email) return res.json(genericResponse);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?,?,?,?)')
    .run(uuid(), user.id, token, expiresAt);
  if (process.env.NODE_ENV === 'production') {
    return res.json(genericResponse);
  }
  res.json({
    ...genericResponse,
    devNote: 'Belum ada email service terpasang — token/link ini dikembalikan langsung untuk testing lokal. Di production, endpoint ini WAJIB dihubungkan ke pengiriman email sungguhan sebelum dipakai (lihat komentar di source).',
    resetToken: token,
    resetUrl: `/reset-password?token=${token}`,
  });
});

router.post('/reset-password', authLimiter, (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'newPassword must be at least 6 characters' });

  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);
  if (!row || row.used_at || new Date(row.expires_at + 'Z').getTime() < Date.now()) {
    return res.status(400).json({ error: 'Link reset ini tidak valid atau sudah kedaluwarsa' });
  }

  const password_hash = bcrypt.hashSync(newPassword, 10);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, row.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
  });
  tx();
  res.json({ ok: true });
});

router.post('/enroll-face', requireAuth, (req, res) => {
  const { embedding } = req.body;
  if (!Array.isArray(embedding) || embedding.length !== 128) {
    return res.status(400).json({ error: 'A 128-length embedding array is required' });
  }
  const id = uuid();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM face_embeddings WHERE user_id = ?').run(req.user.id);
    db.prepare('INSERT INTO face_embeddings (id, user_id, embedding) VALUES (?,?,?)')
      .run(id, req.user.id, JSON.stringify(embedding));
  });
  tx();
  res.json({ ok: true });
});

export default router;