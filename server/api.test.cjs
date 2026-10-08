const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./app');
const { memoryStore } = require('./store');
const validation = require('./validation');
const { memoryAuthStore } = require('./auth');
let server, base, owner;
const clientId = 'test-client.apps.googleusercontent.com';
const store = memoryStore({ legacy: [{ _id: '123456789012345678901234', exercise: 'Old bench press', sets: 3, reps: 8, weight: 50, date: '2026-01-01T12:00:00Z' }] });
const authStore = memoryAuthStore();
async function login(token = 'owner') {
  const bootstrap = await fetch(base + '/api/auth/session'); const setup = await bootstrap.json();
  const initialCookie = bootstrap.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
  const response = await fetch(base + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: initialCookie, 'X-GymTrack-CSRF': setup.csrfToken }, body: JSON.stringify({ credential: token }) });
  const value = await response.json(); assert.equal(response.status, 200);
  return { cookie: response.headers.getSetCookie().map(s => s.split(';')[0]).join('; '), csrf: value.csrfToken, user: value.user };
}
before(async () => {
  server = createApp(store, { auth: { clientId, ownerEmail: 'arron5588@gmail.com', store: authStore, verify: async token => ({ sub: token, email: token === 'owner' ? 'arron5588@gmail.com' : token + '@gmail.com', name: token, email_verified: true, iss: 'https://accounts.google.com', aud: clientId, exp: Math.floor(Date.now() / 1000) + 3600 }) } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port; owner = await login();
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
async function api(route, method = 'GET', body, headers = {}, identity = owner) {
  const response = await fetch(base + '/api/' + route, { method, headers: { 'Content-Type': 'application/json', ...(identity ? { Cookie: identity.cookie, 'X-GymTrack-CSRF': identity.csrf, 'X-GymTrack-Account': identity.user.id } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
function workout() { return { name: 'Upper body', date: '2026-10-06', duration: 45, notes: 'Steady effort', exercises: [{ name: 'Bench press', sets: [{ reps: 8, weight: 50, completed: true }, { reps: 6, weight: 55, completed: false }] }, { name: 'Row', sets: [{ reps: 10, weight: 40, completed: true }] }] }; }
test('health identifies isolated test storage', async () => { assert.deepEqual((await api('health')).body, { ok: true, mode: 'test' }); });
test('session create, edit, history, export and delete', async () => {
  const created = await api('sessions', 'POST', workout()); assert.equal(created.status, 201); assert.match(created.body._id, /^[a-f0-9]{24}$/); assert.equal(created.body.exercises.length, 2); assert.equal(created.body.exercises[0].sets[1].completed, false);
  const updated = await api(`sessions/${created.body._id}`, 'PUT', { ...workout(), name: 'Upper body edited' }); assert.equal(updated.status, 200); assert.equal(updated.body.name, 'Upper body edited');
  assert.ok((await api('sessions')).body.some((s) => s._id === created.body._id));
  const exported = (await api('export')).body; assert.equal(exported.format, 'gymtrack-export-v1'); assert.ok(exported.sessions.some((s) => s.name === 'Upper body edited')); assert.equal(exported.earlierExerciseLogs[0].sets, 3);
  assert.equal((await api(`sessions/${created.body._id}`, 'DELETE')).status, 200); assert.equal((await api(`sessions/${created.body._id}`, 'DELETE')).status, 404);
});
test('legacy records are returned read-only without migration', async () => { const history = (await api('sessions')).body; const legacy = history.find((s) => s.legacy); assert.equal(legacy._id, 'legacy:123456789012345678901234'); assert.equal(legacy.exercises[0].sets.length, 3); assert.equal((await api(`sessions/${legacy._id}`, 'DELETE')).status, 400); assert.equal((await store.legacy({ userId: owner.user.id, legacy: true }))[0].sets, 3); });
test('routines reset completion and support edit/delete', async () => { const created = await api('routines', 'POST', workout()); assert.equal(created.status, 201); assert.equal(created.body.exercises[0].sets[0].completed, false); assert.equal((await api(`routines/${created.body._id}`, 'PUT', { ...workout(), name: 'Push A' })).body.name, 'Push A'); assert.equal((await api(`routines/${created.body._id}`, 'DELETE')).status, 200); });
test('bodyweight create/update/export/delete', async () => { const created = await api('bodyweights', 'POST', { date: '2026-10-06', weight: 75.5 }); assert.equal(created.status, 201); assert.equal((await api(`bodyweights/${created.body._id}`, 'PUT', { date: '2026-10-05', weight: 75 })).body.weight, 75); assert.ok((await api('export')).body.bodyweights.some((w) => w._id === created.body._id)); assert.equal((await api(`bodyweights/${created.body._id}`, 'DELETE')).status, 200); });
test('invalid data and record IDs return client errors', async () => {
  for (const change of [{ name: '' }, { date: '2026-02-30' }, { exercises: [] }, { exercises: [{ name: 'Bench', sets: [{ reps: 1.5, weight: 50 }] }] }, { exercises: [{ name: 'Bench', sets: [{ reps: 8, weight: -1 }] }] }, { exercises: [{ name: 'Bench', sets: [{ reps: 8, weight: 10, completed: false }] }] }]) assert.equal((await api('sessions', 'POST', { ...workout(), ...change })).status, 400);
  assert.equal((await api('sessions/not-an-id', 'PUT', workout())).status, 400); assert.equal((await api('bodyweights', 'POST', { date: '2026-10-06', weight: '75' })).status, 400);
});
test('foreign browser origins cannot read or mutate the app', async () => { assert.equal((await api('sessions', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403); assert.equal((await api('sessions', 'POST', workout(), { Origin: 'https://evil.example' })).status, 403); assert.equal((await api('health', 'GET', undefined, { Origin: 'http://127.0.0.1:5173' })).status, 200); });
test('unknown API routes and nonexistent records are 404', async () => { assert.equal((await api('missing')).status, 404); assert.equal((await api('sessions/000000000000000000000000', 'PUT', workout())).status, 404); });
test('normalisers reject excessive entries and preserve only allowed fields', () => { assert.throws(() => validation.session({ ...workout(), exercises: Array(31).fill(workout().exercises[0]) })); assert.throws(() => validation.session({ ...workout(), exercises: [{ name: 'Test', sets: [{ reps: Infinity, weight: 10 }] }] })); assert.equal(validation.session({ ...workout(), admin: true }).admin, undefined); });

test('anonymous users cannot read or mutate private records or exports', async () => {
  for (const route of ['sessions', 'routines', 'bodyweights', 'export']) assert.equal((await api(route, 'GET', undefined, {}, null)).status, 401);
  assert.equal((await api('sessions', 'POST', workout(), {}, null)).status, 401);
});
test('authenticated writes require matching CSRF and account context', async () => {
  assert.equal((await api('sessions', 'POST', workout(), { 'X-GymTrack-CSRF': '' })).status, 403);
  assert.equal((await api('sessions', 'POST', workout(), { 'X-GymTrack-CSRF': 'forged' })).status, 403);
  assert.equal((await api('sessions', 'GET', undefined, { 'X-GymTrack-Account': 'another-account' })).status, 401);
  assert.equal((await api('sessions', 'POST', workout(), { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
});
test('two-user lists mutations and exports are isolated and body owner IDs cannot be forged', async () => {
  const other = await login('other-user');
  for (const [type, value] of [['sessions', workout()], ['routines', workout()], ['bodyweights', { date: '2026-10-06', weight: 72 }]]) {
    const first = await api(type, 'POST', { ...value, ownerId: other.user.id }); assert.equal(first.status, 201); assert.equal(first.body.ownerId, owner.user.id);
    const foreignList = await api(type, 'GET', undefined, {}, other); assert.ok(!foreignList.body.some(r => r._id === first.body._id));
    assert.equal((await api(type + '/' + first.body._id, 'PUT', value, {}, other)).status, 404);
    assert.equal((await api(type + '/' + first.body._id, 'DELETE', undefined, {}, other)).status, 404);
    const second = await api(type, 'POST', { ...value, ownerId: owner.user.id }, {}, other); assert.equal(second.body.ownerId, other.user.id);
    const ownExport = (await api('export')).body; const foreignExport = (await api('export', 'GET', undefined, {}, other)).body;
    assert.ok(ownExport[type].some(r => r._id === first.body._id)); assert.ok(!ownExport[type].some(r => r._id === second.body._id));
    assert.ok(foreignExport[type].some(r => r._id === second.body._id)); assert.ok(!foreignExport[type].some(r => r._id === first.body._id));
    await api(type + '/' + first.body._id, 'DELETE'); await api(type + '/' + second.body._id, 'DELETE', undefined, {}, other);
  }
  assert.equal((await api('export', 'GET', undefined, {}, other)).body.earlierExerciseLogs.length, 0);
  assert.ok(!(await api('sessions', 'GET', undefined, {}, other)).body.some(s => s.legacy));
});
test('unowned previous data is available only to the verified legacy owner', async () => {
  const seeded = memoryStore({ routines: [{ _id: '111111111111111111111111', name: 'Existing routine', exercises: [] }], legacy: [{ exercise: 'Existing log' }] });
  const ownedScope = { userId: 'owner-id', legacy: true }; const strangerScope = { userId: 'stranger-id', legacy: false };
  assert.equal((await seeded.list('routines', ownedScope)).length, 1); assert.equal((await seeded.list('routines', strangerScope)).length, 0);
  assert.equal((await seeded.legacy(ownedScope)).length, 1); assert.equal((await seeded.legacy(strangerScope)).length, 0);
  assert.equal(await seeded.update('routines', '111111111111111111111111', { name: 'Stolen' }, strangerScope), null);
  assert.equal(await seeded.remove('routines', '111111111111111111111111', strangerScope), null);
  await assert.rejects(() => seeded.list('routines'), /Account scope/);
});
test('logout revokes the session and session cookies are HttpOnly and SameSite', async () => {
  const identity = await login('logout-test'); assert.equal((await api('routines', 'GET', undefined, {}, identity)).status, 200);
  assert.equal((await api('auth/logout', 'POST', {}, {}, identity)).status, 200);
  assert.equal((await api('routines', 'GET', undefined, {}, identity)).status, 401);
});
