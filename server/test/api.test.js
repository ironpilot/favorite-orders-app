import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  server = createApp(openDatabase(':memory:'));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function signUp(email) {
  const { status, data } = await call('POST', '/api/auth/signup', {
    body: { email, password: 'secret123', displayName: email.split('@')[0] },
  });
  assert.equal(status, 201);
  return data;
}

describe('auth', () => {
  it('signs up, signs in, and signs out', async () => {
    const { token, user } = await signUp('auth@example.com');
    assert.equal((await call('GET', '/api/auth/me', { token })).data.id, user.id);

    const bad = await call('POST', '/api/auth/signin', { body: { email: 'auth@example.com', password: 'nope' } });
    assert.equal(bad.status, 401);
    const good = await call('POST', '/api/auth/signin', { body: { email: 'auth@example.com', password: 'secret123' } });
    assert.equal(good.status, 200);

    assert.equal((await call('POST', '/api/auth/signout', { token })).status, 204);
    assert.equal((await call('GET', '/api/auth/me', { token })).status, 401);
  });

  it('rejects duplicate emails and unauthenticated requests', async () => {
    await signUp('dup@example.com');
    const dup = await call('POST', '/api/auth/signup', { body: { email: 'dup@example.com', password: 'secret123' } });
    assert.equal(dup.status, 409);
    assert.equal((await call('GET', '/api/restaurants')).status, 401);
  });
});

describe('restaurants and orders', () => {
  it('lists own restaurants with counts and default items, most recently updated first', async () => {
    const { token } = await signUp('owner@example.com');
    const { token: other } = await signUp('other@example.com');
    const taco = (await call('POST', '/api/restaurants', { token, body: { name: 'Taco Spot' } })).data;
    await call('POST', '/api/restaurants', { token, body: { name: 'Pho House' } });
    await call('POST', `/api/restaurants/${taco.id}/orders`, { token, body: { items: ['Al pastor'], isDefault: true } });
    const second = await call('POST', `/api/restaurants/${taco.id}/orders`, { token, body: { items: ['Carnitas'], isDefault: true } });
    assert.equal(second.data.isDefault, true);

    const list = (await call('GET', '/api/restaurants', { token })).data;
    assert.deepEqual(list.map((r) => [r.name, r.orderCount]), [['Taco Spot', 2], ['Pho House', 0]]);
    assert.deepEqual(list[0].defaultItems, ['Carnitas']);
    assert.deepEqual((await call('GET', '/api/restaurants', { token: other })).data, []);
    assert.equal((await call('GET', `/api/restaurants/${taco.id}/orders`, { token: other })).status, 404);
  });

  it('keeps empty restaurants and requires confirmation to remove one with orders', async () => {
    const { token } = await signUp('remove@example.com');
    const r = (await call('POST', '/api/restaurants', { token, body: { name: 'Diner' } })).data;
    const o = (await call('POST', `/api/restaurants/${r.id}/orders`, { token, body: { items: ['Pancakes'] } })).data;

    assert.equal((await call('DELETE', `/api/restaurants/${r.id}`, { token })).status, 409);
    assert.equal((await call('DELETE', `/api/orders/${o.id}`, { token })).status, 204);
    assert.equal((await call('GET', '/api/restaurants', { token })).data[0].orderCount, 0);
    assert.equal((await call('DELETE', `/api/restaurants/${r.id}`, { token })).status, 204);
  });
});

describe('friends and sharing', () => {
  it('only allows sharing with accepted friends', async () => {
    const a = await signUp('alice@example.com');
    const b = await signUp('bob@example.com');
    const r = (await call('POST', '/api/restaurants', { token: a.token, body: { name: 'Cafe' } })).data;
    const o = (await call('POST', `/api/restaurants/${r.id}/orders`, { token: a.token, body: { items: ['Latte'] } })).data;

    const share = () => call('POST', `/api/orders/${o.id}/shares`, { token: a.token, body: { userId: b.user.id } });
    assert.equal((await call('GET', `/api/orders/${o.id}`, { token: b.token })).status, 404);
    assert.equal((await share()).status, 403);

    const req = (await call('POST', '/api/friends', { token: a.token, body: { userId: b.user.id } })).data;
    assert.equal((await share()).status, 403);
    assert.equal((await call('POST', `/api/friends/${req.id}/accept`, { token: a.token })).status, 404);
    assert.equal((await call('POST', `/api/friends/${req.id}/accept`, { token: b.token })).status, 200);
    assert.equal((await share()).status, 201);

    const shared = (await call('GET', '/api/shared', { token: b.token })).data;
    assert.equal(shared.length, 1);
    assert.equal(shared[0].restaurantName, 'Cafe');
    assert.equal((await call('GET', `/api/orders/${o.id}`, { token: b.token })).status, 200);
    assert.equal((await call('PATCH', `/api/orders/${o.id}`, { token: b.token, body: { notes: 'x' } })).status, 404);
    assert.deepEqual((await call('GET', '/api/restaurants', { token: b.token })).data, []);
  });
});
