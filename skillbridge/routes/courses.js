const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function courseSummary(c) {
  const lessonCount = db.prepare('SELECT COUNT(*) c FROM lessons WHERE course_id = ?').get(c.id).c;
  const reviews = db.prepare('SELECT rating FROM course_reviews WHERE course_id = ?').all(c.id);
  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const enrolledCount = db.prepare('SELECT COUNT(*) c FROM enrollments WHERE course_id = ?').get(c.id).c;
  return { ...c, lessonCount, avgRating, reviewCount: reviews.length, enrolledCount };
}

router.get('/', (req, res) => {
  const { q, category, level } = req.query;
  let sql = 'SELECT * FROM courses WHERE 1=1';
  const params = [];
  if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
  if (level && level !== 'All') { sql += ' AND level = ?'; params.push(level); }
  if (q) { sql += ' AND title LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ courses: rows.map(courseSummary) });
});

router.get('/:id', optionalAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Not found' });
  const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY number ASC').all(course.id);
  const reviews = db.prepare(`
    SELECT r.*, u.name as student_name FROM course_reviews r JOIN users u ON u.id = r.student_id
    WHERE r.course_id = ? ORDER BY r.created_at DESC`).all(course.id);
  let enrollment = null;
  if (req.user) {
    enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?').get(course.id, req.user.id) || null;
    if (enrollment) enrollment.completed_lessons = JSON.parse(enrollment.completed_lessons || '[]');
  }
  res.json({ course: courseSummary(course), lessons, reviews, enrollment });
});

router.post('/', requireAuth, requireRole('instructor'), (req, res) => {
  const { title, category, level, description, cover_url, price, lessons } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const info = db.prepare(`INSERT INTO courses (instructor_id, title, category, level, description, cover_url, price, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    req.user.id, title, category || 'General', level || 'Beginner', description || '', cover_url || '', price || 'Free', Date.now()
  );
  const courseId = info.lastInsertRowid;
  const insertLesson = db.prepare('INSERT INTO lessons (course_id, number, title, content, video_url) VALUES (?, ?, ?, ?, ?)');
  (lessons || []).forEach((l, idx) => insertLesson.run(courseId, idx + 1, l.title || `Lesson ${idx + 1}`, l.content || '', l.video_url || ''));
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  res.status(201).json({ course: courseSummary(course) });
});

router.post('/:id/lessons', requireAuth, requireRole('instructor'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Not found' });
  if (course.instructor_id !== req.user.id) return res.status(403).json({ error: 'Not your course' });
  const { title, content, video_url } = req.body || {};
  const nextNum = (db.prepare('SELECT MAX(number) n FROM lessons WHERE course_id = ?').get(course.id).n || 0) + 1;
  const info = db.prepare('INSERT INTO lessons (course_id, number, title, content, video_url) VALUES (?, ?, ?, ?, ?)')
    .run(course.id, nextNum, title || `Lesson ${nextNum}`, content || '', video_url || '');
  res.status(201).json({ id: info.lastInsertRowid, number: nextNum });
});

router.post('/:id/enroll', requireAuth, requireRole('seeker'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Not found' });
  try {
    db.prepare('INSERT INTO enrollments (course_id, student_id, created_at) VALUES (?, ?, ?)').run(course.id, req.user.id, Date.now());
  } catch (e) { /* already enrolled, ignore */ }
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?').get(course.id, req.user.id);
  res.json({ enrollment: { ...enrollment, completed_lessons: JSON.parse(enrollment.completed_lessons || '[]') } });
});

router.post('/:id/progress', requireAuth, (req, res) => {
  const { lesson_id, completed } = req.body || {};
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?').get(req.params.id, req.user.id);
  if (!enrollment) return res.status(404).json({ error: 'Not enrolled in this course' });
  let done = JSON.parse(enrollment.completed_lessons || '[]');
  if (completed) { if (!done.includes(lesson_id)) done.push(lesson_id); }
  else { done = done.filter(id => id !== lesson_id); }
  db.prepare('UPDATE enrollments SET completed_lessons = ? WHERE id = ?').run(JSON.stringify(done), enrollment.id);
  res.json({ completed_lessons: done });
});

router.post('/:id/reviews', requireAuth, requireRole('seeker'), (req, res) => {
  const { rating, comment } = req.body || {};
  const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
  if (!r) return res.status(400).json({ error: 'Rating must be 1-5' });
  db.prepare(`INSERT INTO course_reviews (course_id, student_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(course_id, student_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at`)
    .run(req.params.id, req.user.id, r, comment || '', Date.now());
  res.json({ ok: true });
});

module.exports = router;
