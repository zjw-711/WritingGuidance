const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb, generateId } = require('./db');

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 小时
const BCRYPT_ROUNDS = 10;
// ========== Cookie 解析 ==========

function getSessionToken(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.split(';').find(c => c.trim().startsWith('session='));
  return match ? match.split('=')[1].trim() : null;
}

function isSecure(req) {
  // 通过 Nginx 的 X-Forwarded-Proto 头判断是否 HTTPS
  return req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(res, token, req) {
  const maxAge = SESSION_MAX_AGE / 1000; // 秒
  const secure = isSecure(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(res, req) {
  const secure = isSecure(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

// ========== 中间件 ==========

function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: '请先登录' });
    }
    return res.redirect('/login');
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.username, u.role
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!row || new Date(row.expires_at) < new Date()) {
    // Session 不存在或已过期
    if (row) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    clearSessionCookie(res, req);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    return res.redirect('/login');
  }

  req.user = { id: row.id, username: row.username, role: row.role };
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    // admin 是所有角色的超集
    if (req.user.role === 'admin' || req.user.role === role) {
      return next();
    }
    return res.status(403).json({ error: '权限不足' });
  };
}

// ========== 用户管理 ==========

function createUser(username, password, role = 'editor') {
  const db = getDb();
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const id = generateId('u');
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(id, username, hash, role);
  return { id, username, role };
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

// ========== Session 管理 ==========

function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return { token, expiresAt };
}

function destroySession(token) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function cleanExpiredSessions() {
  const db = getDb();
  const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  if (result.changes > 0) {
    console.log(`[Auth] 清理了 ${result.changes} 个过期 session`);
  }
}

module.exports = {
  requireAuth,
  requireRole,
  createUser,
  verifyPassword,
  createSession,
  destroySession,
  cleanExpiredSessions,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie
};
