const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const db = require('../db');
const {
  COOKIE_NAME, createSession, getCookie, hashToken, query, requireAuth, sessionCookie
} = require('../auth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const PASSWORD_BYTES = 64;

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, PASSWORD_BYTES)).toString('hex');
}

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email };
}

router.post('/signup', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

  if (!/^[\p{L}\p{N}_.-]{3,50}$/u.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–50 characters and use letters, numbers, dots, dashes, or underscores.' });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 8–128 characters long.' });
  }
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password, salt);
    await new Promise((resolve, reject) => db.beginTransaction(error => error ? reject(error) : resolve()));
    let user;
    try {
      const students = await query('SELECT id FROM students WHERE email = ? LIMIT 1', [email]);
      let studentId;
      if (students.length) {
        studentId = students[0].id;
      } else {
        const studentResult = await query(
          'INSERT INTO students (name, email) VALUES (?, ?)',
          [name, email]
        );
        studentId = studentResult.insertId;
      }
      const result = await query(
        'INSERT INTO users (student_id, username, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)',
        [studentId, username, email, passwordHash, salt]
      );
      await new Promise((resolve, reject) => db.commit(error => error ? reject(error) : resolve()));
      user = { id: result.insertId, username, email };
    } catch (error) {
      await new Promise(resolve => db.rollback(() => resolve()));
      throw error;
    }
    await createSession(user.id, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That username or email is already registered.' });
    }
    console.error('Account creation failed:', error.message);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

router.post('/login', async (req, res) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!identifier || !password || identifier.length > 254 || password.length > 128) {
    return res.status(400).json({ error: 'Enter your username or email and password.' });
  }

  try {
    const users = await query(
      'SELECT id, username, email, password_hash, password_salt FROM users WHERE email = ? OR username = ? LIMIT 1',
      [identifier.toLowerCase(), identifier]
    );
    const user = users[0];
    const salt = user?.password_salt || '0'.repeat(32);
    const actualHash = await hashPassword(password, salt);
    const expectedHash = user?.password_hash || '0'.repeat(PASSWORD_BYTES * 2);
    const valid = crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));

    if (!user || !valid) return res.status(401).json({ error: 'Username/email or password is incorrect.' });

    await createSession(user.id, res);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', async (req, res) => {
  const token = getCookie(req);
  try {
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await query('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
    }
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ success: true });
  } catch (error) {
    console.error('Logout failed:', error.message);
    res.status(500).json({ error: 'Could not log out.' });
  }
});

module.exports = router;
