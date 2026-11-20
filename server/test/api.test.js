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

async function saveOrder(token, restaurantName, body = {}) {
  const res = await call('POST', '/api/orders', { token, body: { restaurantName, items: ['Item'], ...body } });
  assert.equal(res.status, 201);
  return res.data;
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
    await saveOrder(token, 'Pho House');
    const first = await saveOrder(token, 'Taco Spot', { items: ['Al pastor'] });
    const taco = { id: first.restaurantId };
    const second = await call('POST', `/api/restaurants/${taco.id}/orders`, { token, body: { items: ['Carnitas'], isDefault: true } });
    assert.equal(second.data.isDefault, true);

    const list = (await call('GET', '/api/restaurants', { token })).data;
    assert.deepEqual(list.map((r) => [r.name, r.orderCount]), [['Taco Spot', 2], ['Pho House', 1]]);
    assert.deepEqual(list[0].defaultItems, ['Carnitas']);
    assert.deepEqual((await call('GET', '/api/restaurants', { token: other })).data, []);
    assert.equal((await call('GET', `/api/restaurants/${taco.id}/orders`, { token: other })).status, 404);
  });

  it('keeps empty restaurants and requires confirmation to remove one with orders', async () => {
    const { token } = await signUp('remove@example.com');
    const o = await saveOrder(token, 'Diner', { items: ['Pancakes'] });
    const r = { id: o.restaurantId };

    assert.equal((await call('DELETE', `/api/restaurants/${r.id}`, { token })).status, 409);
    assert.equal((await call('DELETE', `/api/orders/${o.id}`, { token })).status, 204);
    assert.equal((await call('GET', '/api/restaurants', { token })).data[0].orderCount, 0);
    assert.equal((await call('DELETE', `/api/restaurants/${r.id}`, { token })).status, 204);
  });
});

describe('default orders', () => {
  it('makes a lone order the default and promotes another when the default is deleted', async () => {
    const { token } = await signUp('default@example.com');
    const first = await saveOrder(token, 'Bagels', { items: ['Everything'] });
    assert.equal(first.isDefault, true);
    const second = await saveOrder(token, 'Bagels', { items: ['Sesame'] });
    assert.equal(second.isDefault, false);

    assert.equal((await call('DELETE', `/api/orders/${first.id}`, { token })).status, 204);
    const orders = (await call('GET', `/api/restaurants/${first.restaurantId}/orders`, { token })).data;
    assert.deepEqual(orders.map((o) => [o.id, o.isDefault]), [[second.id, true]]);
    assert.deepEqual((await call('GET', '/api/restaurants', { token })).data[0].defaultItems, ['Sesame']);
  });

  it('returns empty default items when no order is marked default', async () => {
    const { token } = await signUp('nodefault@example.com');
    const o = await saveOrder(token, 'Deli');
    await call('PATCH', `/api/orders/${o.id}`, { token, body: { isDefault: false } });
    const [r] = (await call('GET', '/api/restaurants', { token })).data;
    assert.equal(r.orderCount, 1);
    assert.deepEqual(r.defaultItems, []);
  });
});

describe('saving orders by restaurant name', () => {
  it('creates a restaurant for a new name and reuses an existing one', async () => {
    const { token } = await signUp('names@example.com');
    const a = await saveOrder(token, 'Burger Barn');
    const b = await saveOrder(token, 'Burger Barn');
    const c = await saveOrder(token, 'Burger Barn ');
    const d = await saveOrder(token, 'Burgr Barn');
    assert.equal(a.restaurantId, b.restaurantId);
    assert.equal(a.restaurantId, c.restaurantId);
    assert.notEqual(a.restaurantId, d.restaurantId);
    const list = (await call('GET', '/api/restaurants', { token })).data;
    assert.deepEqual(list.map((r) => r.name).sort(), ['Burger Barn', 'Burgr Barn']);
    assert.equal((await call('GET', `/api/restaurants/${a.restaurantId}`, { token })).data.name, 'Burger Barn');
  });

  it('has no way to add a restaurant without an order', async () => {
    const { token } = await signUp('noadd@example.com');
    assert.equal((await call('POST', '/api/restaurants', { token, body: { name: 'X' } })).status, 404);
    assert.equal((await call('POST', '/api/orders', { token, body: { items: [] } })).status, 400);
    assert.deepEqual((await call('GET', '/api/restaurants', { token })).data, []);
  });
});

describe('friends and sharing', () => {
  it('only allows sharing with accepted friends', async () => {
    const a = await signUp('alice@example.com');
    const b = await signUp('bob@example.com');
    const o = await saveOrder(a.token, 'Cafe', { items: ['Latte'] });

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
