const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./app');
const { memoryStore } = require('./store');
const validation = require('./validation');
let server, base;
const store = memoryStore();
store.legacy = async () => [{ _id: '123456789012345678901234', exercise: 'Old bench press', sets: 3, reps: 8, weight: 50, date: '2026-01-01T12:00:00Z' }];
before(async () => { server = createApp(store).listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise((resolve) => server.close(resolve)); });
async function api(route, method = 'GET', body, headers = {}) { const response = await fetch(base + '/api/' + route, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; }
function workout() { return { name: 'Upper body', date: '2026-10-06', duration: 45, notes: 'Steady effort', exercises: [{ name: 'Bench press', sets: [{ reps: 8, weight: 50, completed: true }, { reps: 6, weight: 55, completed: false }] }, { name: 'Row', sets: [{ reps: 10, weight: 40, completed: true }] }] }; }
test('health identifies isolated test storage', async () => { assert.deepEqual((await api('health')).body, { ok: true, mode: 'test' }); });
test('session create, edit, history, export and delete', async () => {
  const created = await api('sessions', 'POST', workout()); assert.equal(created.status, 201); assert.match(created.body._id, /^[a-f0-9]{24}$/); assert.equal(created.body.exercises.length, 2); assert.equal(created.body.exercises[0].sets[1].completed, false);
  const updated = await api(`sessions/${created.body._id}`, 'PUT', { ...workout(), name: 'Upper body edited' }); assert.equal(updated.status, 200); assert.equal(updated.body.name, 'Upper body edited');
  assert.ok((await api('sessions')).body.some((s) => s._id === created.body._id));
  const exported = (await api('export')).body; assert.equal(exported.format, 'gymtrack-export-v1'); assert.ok(exported.sessions.some((s) => s.name === 'Upper body edited')); assert.equal(exported.earlierExerciseLogs[0].sets, 3);
  assert.equal((await api(`sessions/${created.body._id}`, 'DELETE')).status, 200); assert.equal((await api(`sessions/${created.body._id}`, 'DELETE')).status, 404);
});
test('legacy records are returned read-only without migration', async () => { const history = (await api('sessions')).body; const legacy = history.find((s) => s.legacy); assert.equal(legacy._id, 'legacy:123456789012345678901234'); assert.equal(legacy.exercises[0].sets.length, 3); assert.equal((await api(`sessions/${legacy._id}`, 'DELETE')).status, 400); assert.equal((await store.legacy())[0].sets, 3); });
test('routines reset completion and support edit/delete', async () => { const created = await api('routines', 'POST', workout()); assert.equal(created.status, 201); assert.equal(created.body.exercises[0].sets[0].completed, false); assert.equal((await api(`routines/${created.body._id}`, 'PUT', { ...workout(), name: 'Push A' })).body.name, 'Push A'); assert.equal((await api(`routines/${created.body._id}`, 'DELETE')).status, 200); });
test('bodyweight create/update/export/delete', async () => { const created = await api('bodyweights', 'POST', { date: '2026-10-06', weight: 75.5 }); assert.equal(created.status, 201); assert.equal((await api(`bodyweights/${created.body._id}`, 'PUT', { date: '2026-10-05', weight: 75 })).body.weight, 75); assert.ok((await api('export')).body.bodyweights.some((w) => w._id === created.body._id)); assert.equal((await api(`bodyweights/${created.body._id}`, 'DELETE')).status, 200); });
test('invalid data and record IDs return client errors', async () => {
  for (const change of [{ name: '' }, { date: '2026-02-30' }, { exercises: [] }, { exercises: [{ name: 'Bench', sets: [{ reps: 1.5, weight: 50 }] }] }, { exercises: [{ name: 'Bench', sets: [{ reps: 8, weight: -1 }] }] }, { exercises: [{ name: 'Bench', sets: [{ reps: 8, weight: 10, completed: false }] }] }]) assert.equal((await api('sessions', 'POST', { ...workout(), ...change })).status, 400);
  assert.equal((await api('sessions/not-an-id', 'PUT', workout())).status, 400); assert.equal((await api('bodyweights', 'POST', { date: '2026-10-06', weight: '75' })).status, 400);
});
test('foreign browser origins cannot read or mutate the app', async () => { assert.equal((await api('sessions', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403); assert.equal((await api('sessions', 'POST', workout(), { Origin: 'https://evil.example' })).status, 403); assert.equal((await api('health', 'GET', undefined, { Origin: 'http://127.0.0.1:5173' })).status, 200); });
test('unknown API routes and nonexistent records are 404', async () => { assert.equal((await api('missing')).status, 404); assert.equal((await api('sessions/000000000000000000000000', 'PUT', workout())).status, 404); });
test('normalisers reject excessive entries and preserve only allowed fields', () => { assert.throws(() => validation.session({ ...workout(), exercises: Array(31).fill(workout().exercises[0]) })); assert.throws(() => validation.session({ ...workout(), exercises: [{ name: 'Test', sets: [{ reps: Infinity, weight: 10 }] }] })); assert.equal(validation.session({ ...workout(), admin: true }).admin, undefined); });
