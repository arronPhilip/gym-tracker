const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./app');
const { memoryStore, scopeFilter } = require('./store');
const { memoryAuthStore, validGooglePayload, same } = require('./auth');
const clientId = 'isolated-client.apps.googleusercontent.com';
const payload = () => ({ sub: 'stable-google-subject', email: 'person@gmail.com', email_verified: true, name: 'Test person', iss: 'https://accounts.google.com', aud: clientId, exp: Math.floor(Date.now() / 1000) + 3600 });
test('Google claims require intended audience, Google issuer, expiry and verified email', () => {
  assert.ok(validGooglePayload(payload(), clientId));
  for (const change of [{ aud: 'attacker-client' }, { iss: 'https://attacker.example' }, { exp: 1 }, { email_verified: false }, { sub: '' }, { nbf: Math.floor(Date.now() / 1000) + 1000 }, { email: null }]) assert.ok(!validGooglePayload({ ...payload(), ...change }, clientId));
});
test('cookie comparison is bounded and safe for malformed Unicode', () => { assert.ok(same('same', 'same')); assert.ok(!same('é', 'x')); assert.ok(!same(undefined, 'x')); assert.ok(!same('x'.repeat(300), 'x'.repeat(300))); });
test('MongoDB ownership predicates always require an account and do not grant legacy access by default', () => { assert.deepEqual(scopeFilter({ userId: 'a' }), { ownerId: 'a' }); assert.deepEqual(scopeFilter({ userId: 'a', legacy: true }), { $or: [{ ownerId: 'a' }, { ownerId: { $exists: false } }] }); assert.throws(() => scopeFilter(), /Account scope/); });
test('expired memory sessions cannot authenticate and Google subjects retain their account key', async () => {
  const store = memoryAuthStore(); const first = await store.user(payload()); const second = await store.user({ ...payload(), name: 'Updated name' }); assert.equal(first._id, second._id); assert.equal(first.draftKey, second.draftKey);
  await store.session('expired-hash', first._id, new Date(1)); assert.equal(await store.lookup('expired-hash'), null);
});
test('production refuses missing HTTPS origin', () => { assert.throws(() => createApp(memoryStore(), { production: true, origin: 'http://not-secure.example' }), /HTTPS/); });
async function temporary(options, work) { const server = createApp(memoryStore(), options).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); try { await work('http://127.0.0.1:' + server.address().port); } finally { await new Promise(resolve => server.close(resolve)); } }
async function setup(base) { const r = await fetch(base + '/api/auth/session'); return { value: await r.json(), cookie: r.headers.getSetCookie().map(s => s.split(';')[0]).join('; ') }; }
async function signIn(base, initial, credential = 'test') { return fetch(base + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: initial.cookie, 'X-GymTrack-CSRF': initial.value.csrfToken }, body: JSON.stringify({ credential }) }); }
test('production session cookies are Secure HttpOnly host-only and SameSite; missing CSRF fails', async () => {
  await temporary({ production: true, origin: 'https://gymtrack.example', auth: { clientId, store: memoryAuthStore(), verify: async () => payload() } }, async base => {
    const initial = await setup(base); assert.match(initial.cookie, /__Host-gymtrack_csrf/);
    const signed = await signIn(base, initial); assert.equal(signed.status, 200); const headers = signed.headers.getSetCookie();
    const sessionCookie = headers.find(s => s.startsWith('__Host-gymtrack_session=')); assert.match(sessionCookie, /HttpOnly/); assert.match(sessionCookie, /Secure/); assert.match(sessionCookie, /SameSite=Strict/); assert.match(sessionCookie, /Path=\//); assert.doesNotMatch(sessionCookie, /Domain=/);
    assert.match(signed.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.ok(signed.headers.get('strict-transport-security'));
    const denied = await fetch(base + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: 'test' }) }); assert.equal(denied.status, 403);
  });
});
test('invalid Google signatures and unverified claims never create authenticated sessions', async () => {
  for (const verify of [async () => { throw new Error('Bad signature'); }, async () => ({ ...payload(), email_verified: false }), async () => ({ ...payload(), aud: 'other-client' })]) {
    await temporary({ auth: { clientId, store: memoryAuthStore(), verify } }, async base => { const r = await signIn(base, await setup(base)); assert.equal(r.status, 401); assert.ok(!r.headers.getSetCookie().some(s => s.includes('gymtrack_session='))); });
  }
});
test('missing Google configuration is fail-closed and login requests are rate-limited', async () => {
  await temporary({ auth: { clientId: '', store: memoryAuthStore() } }, async base => {
    const initial = await setup(base); assert.equal(initial.value.ready, false); assert.equal((await signIn(base, initial)).status, 503);
    assert.equal((await fetch(base + '/api/export')).status, 401);
    for (let i = 0; i < 30; i++) await signIn(base, initial);
    assert.equal((await signIn(base, initial)).status, 429);
  });
});
