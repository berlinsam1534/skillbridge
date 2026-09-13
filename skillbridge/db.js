const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'skillbridge.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'seeker', -- seeker | employer | instructor
  headline TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT DEFAULT 'Remote',
  job_type TEXT DEFAULT 'Full-time', -- Full-time | Part-time | Contract | Internship
  category TEXT DEFAULT 'General',
  salary TEXT DEFAULT '',
  description TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  is_internship INTEGER DEFAULT 0,
  duration TEXT DEFAULT '',
  stipend TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_note TEXT DEFAULT '',
  resume_url TEXT DEFAULT '',
  status TEXT DEFAULT 'submitted', -- submitted | reviewed | shortlisted | rejected | hired
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  level TEXT DEFAULT 'Beginner',
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  price TEXT DEFAULT 'Free',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  video_url TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_lessons TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  UNIQUE(course_id, student_id)
);

CREATE TABLE IF NOT EXISTS course_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(course_id, student_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- job | course | internship
  item_id INTEGER NOT NULL,
  UNIQUE(user_id, item_type, item_id)
);
`);

module.exports = db;
