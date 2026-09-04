import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'admin123';
const name = process.argv[4] || 'Admin';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.log('Admin already exists for that email.');
  process.exit(0);
}

const id = uuid();
db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
  .run(id, name, email, bcrypt.hashSync(password, 10), 'admin');

console.log(`Admin created: ${email} / ${password}`);