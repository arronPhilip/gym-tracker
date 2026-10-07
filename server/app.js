const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const validation = require('./validation');
const { legacySession } = require('./store');
function createApp(store) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const origin = req.headers.origin;
    if (origin) {
      try { const url = new URL(origin); if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return res.status(403).json({ message: 'This personal app only accepts local browser requests.' }); }
      catch { return res.status(403).json({ message: 'Invalid request origin.' }); }
    }
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (req, res) => res.status(store.ready() ? 200 : 503).json({ ok: store.ready(), mode: store.mode }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); if (!store.ready()) return res.status(503).json({ message: 'MongoDB is unavailable. Your draft is still saved in this browser.' }); next(); });
  app.get('/api/sessions', async (req, res) => {
    const [sessions, legacy] = await Promise.all([store.list('sessions'), store.legacy()]);
    res.json([...sessions, ...legacy.map(legacySession)].sort((a, b) => b.date.localeCompare(a.date)));
  });
  for (const [type, normalise] of [['sessions', validation.session], ['routines', validation.routine], ['bodyweights', validation.bodyweight]]) {
    if (type !== 'sessions') app.get(`/api/${type}`, async (req, res) => res.json(await store.list(type)));
    app.post(`/api/${type}`, async (req, res) => res.status(201).json(await store.create(type, normalise(req.body))));
    app.put(`/api/${type}/:id`, async (req, res) => {
      const record = await store.update(type, validation.objectId(req.params.id), normalise(req.body));
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      res.json(record);
    });
    app.delete(`/api/${type}/:id`, async (req, res) => {
      const record = await store.remove(type, validation.objectId(req.params.id));
      if (!record) return res.status(404).json({ message: 'Record not found.' });
      res.json({ message: 'Record deleted.' });
    });
  }
  app.get('/api/export', async (req, res) => {
    const [sessions, routines, bodyweights, earlierExerciseLogs] = await Promise.all([store.list('sessions'), store.list('routines'), store.list('bodyweights'), store.legacy()]);
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
