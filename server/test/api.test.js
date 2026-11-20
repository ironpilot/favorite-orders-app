import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addAdminRestaurant, openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let server;
let base;
let db;

before(async () => {
  db = openDatabase(':memory:');
  server = createApp(db);
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

const items = (...names) => names.map((name) => ({ name }));

// String items are shorthand for { name } items.
async function saveOrder(token, restaurantName, body = {}) {
  const payload = { restaurantName, items: items('Item'), ...body };
  payload.items = payload.items.map((i) => (typeof i === 'string' ? { name: i } : i));
  const res = await call('POST', '/api/orders', { token, body: payload });
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
    const second = await call('POST', `/api/restaurants/${taco.id}/orders`, { token, body: { items: items('Carnitas'), isDefault: true } });
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

describe('administrator-owned restaurants and auto-fill', () => {
  it('suggests administrator-owned and own restaurants, never other users\' ones', async () => {
    const adminId = addAdminRestaurant(db, 'Suggest Burger Co');
    const { token } = await signUp('suggest@example.com');
    const { token: other } = await signUp('suggest2@example.com');
    await saveOrder(token, 'Suggest Burger Shack');
    await saveOrder(other, 'Suggest Burger Secret');
    const res = await call('GET', '/api/restaurant-suggestions?q=suggest%20burger', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.map((r) => [r.name, r.adminOwned]), [['Suggest Burger Co', true], ['Suggest Burger Shack', false]]);
    assert.equal(res.data[0].id, adminId);
  });

  it('saves at a picked administrator-owned restaurant and lists it only for users with orders', async () => {
    const adminId = addAdminRestaurant(db, 'Admin Pizza');
    const a = await signUp('adminpick@example.com');
    const b = await signUp('adminpick2@example.com');
    assert.deepEqual((await call('GET', '/api/restaurants', { token: a.token })).data, []);

    const oa = await saveOrder(a.token, undefined, { restaurantId: adminId, items: ['Margherita'] });
    const ob = await saveOrder(b.token, undefined, { restaurantId: adminId, items: ['Pepperoni'] });
    assert.equal(oa.restaurantId, adminId);
    assert.equal(oa.isDefault, true);
    assert.equal(ob.isDefault, true);

    const [ra] = (await call('GET', '/api/restaurants', { token: a.token })).data;
    assert.deepEqual([ra.name, ra.orderCount, ra.defaultItems, ra.adminOwned], ['Admin Pizza', 1, ['Margherita'], true]);
    const orders = (await call('GET', `/api/restaurants/${adminId}/orders`, { token: a.token })).data;
    assert.deepEqual(orders.map((o) => o.id), [oa.id]);
  });

  it('creates a separate user-created restaurant when a name is typed instead of picked', async () => {
    addAdminRestaurant(db, 'Typed Tacos');
    const { token } = await signUp('typed@example.com');
    const o = await saveOrder(token, 'Typed Tacos');
    const [r] = (await call('GET', '/api/restaurants', { token })).data;
    assert.equal(r.id, o.restaurantId);
    assert.equal(r.adminOwned, false);
  });

  it('does not let users rename or remove administrator-owned restaurants', async () => {
    const adminId = addAdminRestaurant(db, 'Locked Diner');
    const { token } = await signUp('locked@example.com');
    await saveOrder(token, undefined, { restaurantId: adminId });
    assert.equal((await call('PATCH', `/api/restaurants/${adminId}`, { token, body: { name: 'Mine' } })).status, 403);
    assert.equal((await call('DELETE', `/api/restaurants/${adminId}?confirm=true`, { token })).status, 403);
    assert.equal((await call('GET', `/api/restaurants/${adminId}`, { token })).data.name, 'Locked Diner');
  });

  it('rejects picking another user\'s restaurant', async () => {
    const a = await signUp('pickother@example.com');
    const b = await signUp('pickother2@example.com');
    const o = await saveOrder(a.token, 'Hidden');
    const res = await call('POST', '/api/orders', { token: b.token, body: { restaurantId: o.restaurantId, items: items('X') } });
    assert.equal(res.status, 404);
  });

  it('suggests common toppings and the user\'s own past ingredients', async () => {
    const { token } = await signUp('toppings@example.com');
    await saveOrder(token, 'T', { items: [{ name: 'Bowl', customizations: [{ kind: 'add', ingredient: 'Onion Rings' }] }] });
    const res = await call('GET', '/api/toppings?q=onion', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, ['Onion Rings', 'Onions']);
    assert.ok((await call('GET', '/api/toppings', { token })).data.length > 0);
  });
});

describe('structured orders', () => {
  const burger = {
    name: 'Hamburger',
    quantity: 2,
    customizations: [
      { kind: 'remove', ingredient: 'Lettuce' },
      { kind: 'add', ingredient: 'Onions' },
      { kind: 'substitute', ingredient: 'Mayonnaise', insteadOf: 'Ketchup' },
    ],
  };
  const fries = { name: 'Fries', quantity: 1, customizations: [] };

  it('round-trips several items with mixed customizations unchanged', async () => {
    const { token } = await signUp('struct@example.com');
    const o = await saveOrder(token, 'Burger Barn', { title: 'Game night', notes: 'Extra napkins', items: [burger, fries] });
    assert.deepEqual(o.items, [burger, fries]);
    const read = (await call('GET', `/api/orders/${o.id}`, { token })).data;
    assert.deepEqual(read.items, [burger, fries]);
    assert.equal(read.title, 'Game night');
    assert.equal(read.notes, 'Extra napkins');
    const listed = (await call('GET', `/api/restaurants/${o.restaurantId}/orders`, { token })).data;
    assert.deepEqual(listed[0].items, [burger, fries]);
    assert.deepEqual((await call('GET', '/api/restaurants', { token })).data[0].defaultItems, ['Hamburger', 'Fries']);
  });

  it('rejects an order with no items, on create and update', async () => {
    const { token } = await signUp('noitems@example.com');
    assert.equal((await call('POST', '/api/orders', { token, body: { restaurantName: 'X', items: [] } })).status, 400);
    assert.equal((await call('POST', '/api/orders', { token, body: { restaurantName: 'X' } })).status, 400);
    assert.deepEqual((await call('GET', '/api/restaurants', { token })).data, []);
    const o = await saveOrder(token, 'Y');
    assert.equal((await call('PATCH', `/api/orders/${o.id}`, { token, body: { items: [] } })).status, 400);
  });

  it('defaults quantity to 1, rejects below 1, and accepts large quantities', async () => {
    const { token } = await signUp('qty@example.com');
    const o = await saveOrder(token, 'Qty', { items: [{ name: 'Taco' }] });
    assert.equal(o.items[0].quantity, 1);
    for (const quantity of [0, -1, 1.5, '2']) {
      const res = await call('POST', '/api/orders', { token, body: { restaurantName: 'Qty', items: [{ name: 'Taco', quantity }] } });
      assert.equal(res.status, 400, `quantity ${quantity}`);
    }
    const big = await saveOrder(token, 'Qty', { items: [{ name: 'Taco', quantity: 500 }] });
    assert.equal(big.items[0].quantity, 500);
  });

  it('rejects invalid customizations', async () => {
    const { token } = await signUp('custom@example.com');
    const bad = [
      { kind: 'swap', ingredient: 'X' },
      { kind: 'remove', ingredient: ' ' },
      { kind: 'substitute', ingredient: 'Mayo' },
    ];
    for (const c of bad) {
      const res = await call('POST', '/api/orders', { token, body: { restaurantName: 'C', items: [{ name: 'A', customizations: [c] }] } });
      assert.equal(res.status, 400);
    }
  });

  it('accepts an order without a name', async () => {
    const { token } = await signUp('noname@example.com');
    const o = await saveOrder(token, 'Anon');
    assert.equal(o.title, '');
  });

  it('rejects over-long text', async () => {
    const { token } = await signUp('long@example.com');
    const long = 'x'.repeat(1001);
    assert.equal((await call('POST', '/api/orders', { token, body: { restaurantName: long, items: items('A') } })).status, 400);
    assert.equal((await call('POST', '/api/orders', { token, body: { restaurantName: 'L', items: items(long) } })).status, 400);
    assert.equal((await call('POST', '/api/orders', { token, body: { restaurantName: 'L', items: items('A'), notes: long } })).status, 400);
  });

  it('updates items and ignores a client-sent owner id', async () => {
    const a = await signUp('upd@example.com');
    const b = await signUp('upd2@example.com');
    const o = await saveOrder(a.token, 'Upd', { ownerId: b.user.id });
    assert.equal(o.ownerId, a.user.id);
    const res = await call('PATCH', `/api/orders/${o.id}`, { token: a.token, body: { items: [burger], ownerId: b.user.id } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.items, [burger]);
    assert.equal(res.data.ownerId, a.user.id);
  });

  it('does not let another user read, update or delete the order', async () => {
    const a = await signUp('priv@example.com');
    const b = await signUp('priv2@example.com');
    const o = await saveOrder(a.token, 'Private', { items: [burger] });
    assert.equal((await call('GET', `/api/orders/${o.id}`, { token: b.token })).status, 404);
    assert.equal((await call('PATCH', `/api/orders/${o.id}`, { token: b.token, body: { items: [fries] } })).status, 404);
    assert.equal((await call('DELETE', `/api/orders/${o.id}`, { token: b.token })).status, 404);
    assert.deepEqual((await call('GET', `/api/orders/${o.id}`, { token: a.token })).data.items, [burger]);
  });

  it('cannot move an order to a different restaurant', async () => {
    const { token } = await signUp('move@example.com');
    const o = await saveOrder(token, 'First');
    const other = await saveOrder(token, 'Second');
    const res = await call('PATCH', `/api/orders/${o.id}`, { token, body: { restaurantId: other.restaurantId } });
    assert.equal(res.status, 400);
    assert.equal((await call('GET', `/api/orders/${o.id}`, { token })).data.restaurantId, o.restaurantId);
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
