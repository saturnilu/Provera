import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
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

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/enroll-face', requireAuth, (req, res) => {
  const { embedding } = req.body;
  if (!Array.isArray(embedding) || embedding.length !== 128) {
    return res.status(400).json({ error: 'A 128-length embedding array is required' });
  }
  const id = uuid();
  db.prepare('INSERT INTO face_embeddings (id, user_id, embedding) VALUES (?,?,?)')
    .run(id, req.user.id, JSON.stringify(embedding));
  res.json({ ok: true });
});

export default router;