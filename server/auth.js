const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const userSchema = new mongoose.Schema({ googleId: { type: String, required: true, unique: true, index: true }, email: String, name: String, draftKey: String }, { timestamps: true });
const loginSchema = new mongoose.Schema({ tokenHash: { type: String, required: true, unique: true, index: true }, userId: { type: mongoose.Schema.Types.ObjectId, required: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } } });
const User = mongoose.models.GymTrackUser || mongoose.model('GymTrackUser', userSchema);
const Login = mongoose.models.GymTrackLogin || mongoose.model('GymTrackLogin', loginSchema);
const random = () => randomBytes(32).toString('base64url');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
function cookies(req) { const result = {}; for (const part of (req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) result[part.slice(0, i).trim()] = part.slice(i + 1).trim(); } return result; }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length > 256 || a.length !== b.length) return false; const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
function cookieNames(secure) { return { session: secure ? '__Host-gymtrack_session' : 'gymtrack_session', csrf: secure ? '__Host-gymtrack_csrf' : 'gymtrack_csrf' }; }
function setCookie(res, name, value, { secure, httpOnly = false, maxAge = SESSION_MS / 1000 }) { res.append('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure ? '; Secure' : ''}${httpOnly ? '; HttpOnly' : ''}`); }
const mongoAuthStore = {
  ensureIndexes: async () => { await User.createIndexes(); await Login.createIndexes(); },
  user: async (payload) => {
    const existing = await User.findOne({ googleId: payload.sub });
    if (existing) { existing.email = payload.email; existing.name = String(payload.name || '').slice(0, 100); if (!existing.draftKey) existing.draftKey = random(); await existing.save(); return existing.toObject(); }
    try { return (await User.create({ googleId: payload.sub, email: payload.email, name: String(payload.name || '').slice(0, 100), draftKey: random() })).toObject(); }
    catch (error) { if (error.code !== 11000) throw error; return User.findOne({ googleId: payload.sub }).lean(); }
  },
  session: async (tokenHash, userId, expiresAt) => { await Login.create({ tokenHash, userId, expiresAt }); },
  lookup: async (tokenHash) => { const login = await Login.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean(); return login ? User.findById(login.userId).lean() : null; },
  revoke: async (tokenHash) => { await Login.deleteOne({ tokenHash }); },
};
function memoryAuthStore() { const users = new Map(); const sessions = new Map(); return {
  user: async (payload) => { const previous = users.get(payload.sub); const value = { _id: previous?._id || randomBytes(12).toString('hex'), googleId: payload.sub, email: payload.email, name: payload.name || '', draftKey: previous?.draftKey || random() }; users.set(payload.sub, value); return value; },
  session: async (tokenHash, userId, expiresAt) => { sessions.set(tokenHash, { userId: String(userId), expiresAt: new Date(expiresAt).getTime() }); },
  lookup: async (tokenHash) => { const session = sessions.get(tokenHash); return session && session.expiresAt > Date.now() ? [...users.values()].find(u => String(u._id) === session.userId) : null; },
  revoke: async (tokenHash) => { sessions.delete(tokenHash); },
}; }
function validGooglePayload(payload, clientId) {
  return payload && typeof payload.sub === 'string' && payload.sub.length > 0 && payload.sub.length <= 255 && typeof payload.email === 'string' && payload.email_verified === true && (payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com') && payload.aud === clientId && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now() && (!payload.nbf || payload.nbf * 1000 <= Date.now()) && (payload.email.toLowerCase().endsWith('@gmail.com') || typeof payload.hd === 'string');
}
function createAuth(options = {}) {
  const secure = options.secure ?? process.env.NODE_ENV === 'production';
  const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '';
  const ownerEmail = (options.ownerEmail ?? process.env.LEGACY_OWNER_EMAIL ?? '').trim().toLowerCase();
  const store = options.store || mongoAuthStore;
  const google = new OAuth2Client(clientId);
  const verify = options.verify || (async credential => (await google.verifyIdToken({ idToken: credential, audience: clientId })).getPayload());
  const names = cookieNames(secure);
  const publicUser = user => ({ id: String(user._id), email: user.email, name: user.name, draftKey: user.draftKey });
  function csrf(req, res) { const existing = cookies(req)[names.csrf]; const token = existing && /^[A-Za-z0-9_-]{43}$/.test(existing) ? existing : random(); setCookie(res, names.csrf, token, { secure }); return token; }
  const rates = new Map();
  function loginLimit(req, res, next) { const now = Date.now(); const ip = req.ip || 'unknown'; let value = rates.get(ip); if (!value || value.until <= now) { value = { count: 0, until: now + 15 * 60000 }; rates.set(ip, value); } if (++value.count > 30) return res.status(429).json({ message: 'Too many sign-in attempts. Please try again later.' }); if (rates.size > 10000) for (const [key, item] of rates) if (item.until <= now) rates.delete(key); next(); }
  function csrfGuard(req, res, next) { if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next(); if (!same(cookies(req)[names.csrf], req.headers['x-gymtrack-csrf'])) return res.status(403).json({ message: 'Security check expired. Reload the page and try again.' }); next(); }
  async function identity(req) { const token = cookies(req)[names.session]; return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? store.lookup(hash(token)) : null; }
  function install(app) {
    app.get('/api/auth/session', async (req, res) => { const user = await identity(req); res.json({ user: user ? publicUser(user) : null, clientId, ready: !!clientId, csrfToken: csrf(req, res) }); });
    app.post('/api/auth/google', loginLimit, csrfGuard, async (req, res) => {
      if (!clientId) return res.status(503).json({ message: 'Google sign-in is not configured yet. No workout data is publicly accessible.' });
      if (typeof req.body?.credential !== 'string' || req.body.credential.length > 12000) return res.status(400).json({ message: 'Invalid Google credential.' });
      let payload; try { payload = await verify(req.body.credential); } catch { return res.status(401).json({ message: 'Unable to verify Google sign-in. Please try again.' }); }
      if (!validGooglePayload(payload, clientId)) return res.status(401).json({ message: 'Sign in with a verified Gmail or Google Workspace account.' });
      const previous = cookies(req)[names.session]; if (previous) await store.revoke(hash(previous));
      const user = await store.user(payload); const token = random();
      await store.session(hash(token), user._id, new Date(Date.now() + SESSION_MS));
      setCookie(res, names.session, token, { secure, httpOnly: true });
      const csrfToken = random(); setCookie(res, names.csrf, csrfToken, { secure });
      res.json({ user: publicUser(user), csrfToken });
    });
    app.post('/api/auth/logout', csrfGuard, async (req, res) => { const token = cookies(req)[names.session]; if (token) await store.revoke(hash(token)); setCookie(res, names.session, '', { secure, httpOnly: true, maxAge: 0 }); setCookie(res, names.csrf, '', { secure, maxAge: 0 }); res.json({ message: 'Signed out.' }); });
  }
  async function requireUser(req, res, next) { const user = await identity(req); if (!user) return res.status(401).json({ message: 'Sign in to access your private training data.' }); if (req.headers['x-gymtrack-account'] !== String(user._id)) return res.status(401).json({ message: 'Your account changed. Reload the page before accessing workout data.' }); req.user = user; req.scope = { userId: String(user._id), legacy: !!ownerEmail && user.email.toLowerCase() === ownerEmail }; next(); }
  return { install, requireUser, csrfGuard };
}
module.exports = { createAuth, memoryAuthStore, mongoAuthStore, validGooglePayload, cookies, same, SESSION_MS };
