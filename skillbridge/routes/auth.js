const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password, role, headline } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  const validRoles = ['seeker', 'employer', 'instructor'];
  const finalRole = validRoles.includes(role) ? role : 'seeker';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password, role, headline, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email.toLowerCase(), hash, finalRole, headline || '', Date.now());

  const user = db.prepare('SELECT id, name, email, role, headline FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = sign(user);
  res.json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = sign(user);
  delete user.password;
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, headline, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
