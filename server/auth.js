const crypto = require('crypto');
const db = require('./db');

const COOKIE_NAME = 'resume_session';
const SESSION_DAYS = 7;

function query(sql, values = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results) => error ? reject(error) : resolve(results));
  });
}

function getCookie(req) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : null;
}

function sessionCookie(token, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token), userId, expiresAt
  ]);
  res.setHeader('Set-Cookie', sessionCookie(token));
}

async function requireAuth(req, res, next) {
  try {
    const token = getCookie(req);
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }

    const sessions = await query(`
      SELECT u.id, u.student_id AS studentId, u.username, u.email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > NOW()
      LIMIT 1
    `, [hashToken(token)]);

    if (!sessions.length) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    req.user = sessions[0];
    next();
  } catch (error) {
    console.error('Session lookup failed:', error.message);
    res.status(500).json({ error: 'Could not verify login session.' });
  }
}

module.exports = { COOKIE_NAME, createSession, getCookie, hashToken, query, requireAuth, sessionCookie };
