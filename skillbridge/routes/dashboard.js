const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const uid = req.user.id;
  const role = req.user.role;
  const out = {};

  if (role === 'seeker') {
    out.myApplications = db.prepare(`
      SELECT a.*, j.title, j.company, j.is_internship FROM applications a
      JOIN jobs j ON j.id = a.job_id WHERE a.applicant_id = ? ORDER BY a.created_at DESC`).all(uid);
    out.myEnrollments = db.prepare(`
      SELECT e.*, c.title, c.category FROM enrollments e
      JOIN courses c ON c.id = e.course_id WHERE e.student_id = ? ORDER BY e.created_at DESC`).all(uid)
      .map(e => ({ ...e, completed_lessons: JSON.parse(e.completed_lessons || '[]') }));
  }
  if (role === 'employer') {
    out.myListings = db.prepare('SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC').all(uid)
      .map(j => ({ ...j, tags: JSON.parse(j.tags || '[]'), applicantCount: db.prepare('SELECT COUNT(*) c FROM applications WHERE job_id = ?').get(j.id).c }));
  }
  if (role === 'instructor') {
    out.myCourses = db.prepare('SELECT * FROM courses WHERE instructor_id = ? ORDER BY created_at DESC').all(uid)
      .map(c => ({ ...c, enrolledCount: db.prepare('SELECT COUNT(*) c FROM enrollments WHERE course_id = ?').get(c.id).c }));
  }

  const favs = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(uid);
  out.favorites = favs;
  res.json(out);
});

router.post('/favorites', requireAuth, (req, res) => {
  const { item_type, item_id } = req.body || {};
  if (!['job', 'course', 'internship'].includes(item_type)) return res.status(400).json({ error: 'Invalid item type' });
  try {
    db.prepare('INSERT INTO favorites (user_id, item_type, item_id) VALUES (?, ?, ?)').run(req.user.id, item_type, item_id);
  } catch (e) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?').run(req.user.id, item_type, item_id);
  }
  const favs = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(req.user.id);
  res.json({ favorites: favs });
});

module.exports = router;
