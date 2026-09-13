const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function serializeJob(j) {
  return { ...j, tags: JSON.parse(j.tags || '[]'), is_internship: !!j.is_internship };
}

// List jobs / internships. ?kind=job|internship, ?q=search, ?category=, ?type=
router.get('/', (req, res) => {
  const { kind, q, category, job_type } = req.query;
  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  if (kind === 'internship') { sql += ' AND is_internship = 1'; }
  else if (kind === 'job') { sql += ' AND is_internship = 0'; }
  if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
  if (job_type && job_type !== 'All') { sql += ' AND job_type = ?'; params.push(job_type); }
  if (q) { sql += ' AND (title LIKE ? OR company LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ jobs: rows.map(serializeJob) });
});

router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const applicantCount = db.prepare('SELECT COUNT(*) c FROM applications WHERE job_id = ?').get(job.id).c;
  res.json({ job: { ...serializeJob(job), applicantCount } });
});

router.post('/', requireAuth, requireRole('employer'), (req, res) => {
  const { title, company, location, job_type, category, salary, description, tags, is_internship, duration, stipend } = req.body || {};
  if (!title || !company) return res.status(400).json({ error: 'Title and company are required' });
  const info = db.prepare(`INSERT INTO jobs
    (employer_id, title, company, location, job_type, category, salary, description, tags, is_internship, duration, stipend, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    req.user.id, title, company, location || 'Remote', job_type || 'Full-time', category || 'General',
    salary || '', description || '', JSON.stringify(tags || []), is_internship ? 1 : 0,
    duration || '', stipend || '', Date.now()
  );
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ job: serializeJob(job) });
});

router.delete('/:id', requireAuth, requireRole('employer'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (job.employer_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// applications
router.post('/:id/apply', requireAuth, requireRole('seeker'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const { cover_note, resume_url } = req.body || {};
  try {
    const info = db.prepare(
      'INSERT INTO applications (job_id, applicant_id, cover_note, resume_url, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(job.id, req.user.id, cover_note || '', resume_url || '', Date.now());
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ error: 'You already applied to this listing' });
  }
});

router.get('/:id/applications', requireAuth, requireRole('employer'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (job.employer_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
  const rows = db.prepare(`
    SELECT a.*, u.name as applicant_name, u.email as applicant_email, u.headline as applicant_headline
    FROM applications a JOIN users u ON u.id = a.applicant_id
    WHERE a.job_id = ? ORDER BY a.created_at DESC`).all(job.id);
  res.json({ applications: rows });
});

router.patch('/applications/:appId/status', requireAuth, requireRole('employer'), (req, res) => {
  const { status } = req.body || {};
  const valid = ['submitted', 'reviewed', 'shortlisted', 'rejected', 'hired'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const app = db.prepare(`SELECT a.*, j.employer_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(req.params.appId);
  if (!app) return res.status(404).json({ error: 'Not found' });
  if (app.employer_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, req.params.appId);
  res.json({ ok: true });
});

module.exports = router;
