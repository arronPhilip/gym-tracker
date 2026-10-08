const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const validation = require('./validation');
const { legacySession } = require('./store');
const { createAuth } = require('./auth');
function createApp(store, options = {}) {
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const configuredOrigin = options.origin ?? (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL);
  if (production && (!configuredOrigin || new URL(configuredOrigin).protocol !== 'https:')) throw new Error('A HTTPS APP_ORIGIN is required in production.');
  const origins = configuredOrigin ? [new URL(configuredOrigin).origin] : ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5000', 'http://localhost:5000'];
  const auth = createAuth({ secure: production, ...options.auth });
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (production) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) return res.status(403).json({ message: 'This request origin is not allowed.' });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ message: 'Cross-site writes are not allowed.' });
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (req, res) => res.status(store.ready() ? 200 : 503).json({ ok: store.ready(), mode: store.mode }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); if (!store.ready()) return res.status(503).json({ message: 'The database is temporarily unavailable. Your draft remains encrypted on this device.' }); next(); });
  auth.install(app);
  app.use('/api', auth.requireUser, auth.csrfGuard);
  app.get('/api/sessions', async (req, res) => {
    const [sessions, legacy] = await Promise.all([store.list('sessions', req.scope), store.legacy(req.scope)]);
    res.json([...sessions, ...legacy.map(legacySession)].sort((a, b) => b.date.localeCompare(a.date)));
  });
  for (const [type, normalise] of [['sessions', validation.session], ['routines', validation.routine], ['bodyweights', validation.bodyweight]]) {
    if (type !== 'sessions') app.get(`/api/${type}`, async (req, res) => res.json(await store.list(type, req.scope)));
    app.post(`/api/${type}`, async (req, res) => res.status(201).json(await store.create(type, normalise(req.body), req.scope)));
    app.put(`/api/${type}/:id`, async (req, res) => {
      const record = await store.update(type, validation.objectId(req.params.id), normalise(req.body), req.scope);
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      res.json(record);
    });
    app.delete(`/api/${type}/:id`, async (req, res) => {
      const record = await store.remove(type, validation.objectId(req.params.id), req.scope);
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      res.json({ message: 'Record deleted.' });
    });
  }
  app.get('/api/export', async (req, res) => {
    const [sessions, routines, bodyweights, earlierExerciseLogs] = await Promise.all([store.list('sessions', req.scope), store.list('routines', req.scope), store.list('bodyweights', req.scope), store.legacy(req.scope)]);
    res.json({ format: 'gymtrack-export-v1', exportedAt: new Date().toISOString(), units: 'kg', sessions, routines, bodyweights, earlierExerciseLogs });
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
  const dist = path.resolve(__dirname, '../dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else app.get('/', (req, res) => res.json({ message: 'GymTrack API. Start the website with npm run dev in the project folder.' }));
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = error.status === 400 || error.type === 'entity.parse.failed' ? 400 : error.status === 413 ? 413 : 500;
    res.status(status).json({ message: status === 400 ? (error instanceof validation.InputError ? error.message : 'Invalid JSON request.') : status === 413 ? 'Request is too large.' : 'Unable to complete the request. Please try again.' });
  });
  return app;
}
module.exports = { createApp };
