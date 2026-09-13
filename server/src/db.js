import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','lecturer','student')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS face_embeddings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  embedding TEXT NOT NULL, -- JSON array of 128 floats
  created_at TEXT DEFAULT (datetime('now'))
);

-- One join_code per room (not per student), reusable until max_participants is
-- reached. extended_minutes accumulates every "extend time" the lecturer does,
-- so the exam deadline survives a page reload / student rejoining.
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  lecturer_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  extended_minutes INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 50,
  join_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','in_progress','ended','deleted')),
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  type TEXT NOT NULL CHECK (type IN ('essay','mcq_single','mcq_multi')),
  prompt TEXT NOT NULL,
  options TEXT, -- JSON array, for mcq/dropdown
  correct_answer TEXT, -- JSON, null for essay
  word_limit_min INTEGER,
  word_limit_max INTEGER,
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS room_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','completed','flagged')),
  joined_at TEXT DEFAULT (datetime('now')),
  exam_started_at TEXT,
  exam_ended_at TEXT,
  total_score REAL DEFAULT 0,
  UNIQUE(room_id, student_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  room_session_id TEXT NOT NULL REFERENCES room_sessions(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  answer_value TEXT, -- JSON
  is_correct INTEGER, -- NULL until graded (essay), 0/1 otherwise
  score REAL DEFAULT 0,
  graded_by TEXT REFERENCES users(id),
  graded_at TEXT,
  UNIQUE(room_session_id, question_id)
);

CREATE TABLE IF NOT EXISTS violation_logs (
  id TEXT PRIMARY KEY,
  room_session_id TEXT NOT NULL REFERENCES room_sessions(id),
  type TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  duration_seconds REAL DEFAULT 0
);

-- Co-lecturers a room owner can add so someone else (e.g. a proctor/TA) can
-- also monitor live violations and review the recap for that room. Only the
-- owning lecturer (rooms.lecturer_id) can manage questions, the room itself,
-- start/extend/end the exam, or add/remove assistants.
CREATE TABLE IF NOT EXISTS room_assistants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  added_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(room_id, user_id)
);

-- Password-reset tokens for the "lupa password" flow. A token is a random
-- opaque string (not the JWT) with a short expiry, single-use.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- A lecturer's "mata kuliah" — groups rooms/exams together over time so
-- there's a history per class instead of every room being one-off.
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  lecturer_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  code TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Lecturer's personal, reusable pool of questions — write once, drop into
-- any room later instead of retyping the same question every time.
CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  lecturer_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('essay','mcq_single','mcq_multi')),
  prompt TEXT NOT NULL,
  options TEXT,
  correct_answer TEXT,
  word_limit_min INTEGER,
  word_limit_max INTEGER,
  points INTEGER NOT NULL DEFAULT 1,
  tag TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existing.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('rooms', 'extended_minutes', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('rooms', 'max_participants', 'INTEGER NOT NULL DEFAULT 50');
ensureColumn('rooms', 'join_code', 'TEXT');
ensureColumn('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('rooms', 'course_id', 'TEXT REFERENCES courses(id)');

export default db;