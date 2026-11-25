import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addAdminRestaurant, addAdminTopping, openDatabase, removeAdminTopping } from '../src/db.js';
import { createApp } from '../src/app.js';

let server;
let base;
let db;
const mail = [];
let clockOffset = 0;
const lastMail = (to) => mail.filter((m) => m.to === to).at(-1);

before(async () => {
  db = openDatabase(':memory:');
  server = createApp(db, { mailer: { send: (m) => mail.push(m) }, clock: () => Date.now() + clockOffset });
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

let phoneSeq = 7000000;
const nextPhone = () => `+1555${phoneSeq++}`;

async function signUpUnverified(email, phone = nextPhone()) {
  const { status, data } = await call('POST', '/api/auth/signup', {
    body: { email, phone, password: 'secret123', displayName: email.split('@')[0] },
  });
  assert.equal(status, 201);
  return data;
}

async function signUp(email, phone) {
  const data = await signUpUnverified(email, phone);
  const res = await call('POST', '/api/auth/verify', { token: data.token, body: { code: lastMail(email).code } });
  assert.equal(res.status, 200);
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

  it('rejects duplicate email or phone with the same generic error, and unauthenticated requests', async () => {
    await signUp('dup@example.com', '+15559990001');
    const body = { displayName: 'Dup', password: 'secret123' };
    const byEmail = await call('POST', '/api/auth/signup', { body: { ...body, email: 'DUP@example.com', phone: '+15559990002' } });
    const byPhone = await call('POST', '/api/auth/signup', { body: { ...body, email: 'dup2@example.com', phone: '+1 (555) 999-0001' } });
    assert.equal(byEmail.status, 409);
    assert.equal(byPhone.status, 409);
    assert.deepEqual(byEmail.data, byPhone.data);
    assert.equal((await call('GET', '/api/restaurants')).status, 401);
  });

  it('rejects missing or invalid fields and weak passwords', async () => {
    const valid = { displayName: 'Val', email: 'val@example.com', phone: '+15558880001', password: 'secret123' };
    const cases = [
      { displayName: ' ' },
      { email: undefined },
      { email: 'not-an-email' },
      { phone: undefined },
      { phone: 'abc' },
      { password: undefined },
      { password: 'short1' },
      { password: 'lettersonly' },
      { password: '12345678' },
    ];
    for (const c of cases) {
      const res = await call('POST', '/api/auth/signup', { body: { ...valid, ...c } });
      assert.equal(res.status, 400, JSON.stringify(c));
    }
    assert.equal((await call('POST', '/api/auth/signup', { body: valid })).status, 201);
  });
});

describe('email verification', () => {
  it('sends a 15-minute code on sign-up and a valid code verifies the account', async () => {
    const { token, user } = await signUpUnverified('verify@example.com');
    assert.equal(user.emailVerified, false);
    const expires = Date.parse(user.verificationExpiresAt) - Date.now();
    assert.ok(expires > 14 * 60_000 && expires <= 15 * 60_000);
    assert.match(lastMail('verify@example.com').code, /^\d{6}$/);

    assert.equal((await call('POST', '/api/auth/verify', { token, body: { code: 'wrong' } })).status, 400);
    const ok = await call('POST', '/api/auth/verify', { token, body: { code: lastMail('verify@example.com').code } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.emailVerified, true);
    assert.equal((await call('GET', '/api/restaurants', { token })).status, 200);
  });

  it('blocks unverified users from the app, including after sign-in', async () => {
    const { token } = await signUpUnverified('unverified@example.com');
    assert.equal((await call('GET', '/api/restaurants', { token })).status, 403);
    const signin = await call('POST', '/api/auth/signin', { body: { email: 'unverified@example.com', password: 'secret123' } });
    assert.equal(signin.status, 200);
    assert.equal(signin.data.user.emailVerified, false);
    assert.equal((await call('GET', '/api/restaurants', { token: signin.data.token })).status, 403);
    assert.equal((await call('GET', '/api/auth/me', { token })).data.emailVerified, false);
  });

  it('rejects expired and invalidated codes', async () => {
    const { token } = await signUpUnverified('expire@example.com');
    const first = lastMail('expire@example.com').code;
    clockOffset = 61_000;
    try {
      assert.equal((await call('POST', '/api/auth/resend-verification', { token })).status, 200);
      const second = lastMail('expire@example.com').code;
      if (first !== second) {
        assert.equal((await call('POST', '/api/auth/verify', { token, body: { code: first } })).status, 400);
      }
      clockOffset = 61_000 + 15 * 60_000 + 1;
      const expired = await call('POST', '/api/auth/verify', { token, body: { code: second } });
      assert.equal(expired.status, 400);
      assert.match(expired.data.error, /expired/);
    } finally {
      clockOffset = 0;
    }
  });

  it('limits resends to 1 per minute and 5 per hour', async () => {
    const { token } = await signUpUnverified('resend@example.com');
    try {
      assert.equal((await call('POST', '/api/auth/resend-verification', { token })).status, 429);
      for (let i = 1; i <= 4; i++) {
        clockOffset = i * 61_000;
        assert.equal((await call('POST', '/api/auth/resend-verification', { token })).status, 200, `resend ${i}`);
      }
      clockOffset = 6 * 61_000;
      assert.equal((await call('POST', '/api/auth/resend-verification', { token })).status, 429);
      clockOffset = 61 * 60_000 + 61_000;
      assert.equal((await call('POST', '/api/auth/resend-verification', { token })).status, 200);
    } finally {
      clockOffset = 0;
    }
  });
});

describe('sign out and forgot password', () => {
  it('revokes the session on sign-out', async () => {
    const { token } = await signUp('signout@example.com');
    assert.equal((await call('POST', '/api/auth/signout', { token })).status, 204);
    assert.equal((await call('GET', '/api/restaurants', { token })).status, 401);
  });

  it('resets the password once with an emailed link and signs out other sessions', async () => {
    const { token } = await signUp('reset@example.com');
    const res = await call('POST', '/api/auth/forgot-password', { body: { email: 'reset@example.com' } });
    assert.equal(res.status, 202);
    const { link, token: resetToken } = lastMail('reset@example.com');
    assert.ok(link.includes(`/reset-password?token=${resetToken}`));

    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'weak' } })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'newpass456' } })).status, 204);
    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'other789x' } })).status, 400);
    assert.equal((await call('GET', '/api/auth/me', { token })).status, 401);
    const signin = await call('POST', '/api/auth/signin', { body: { email: 'reset@example.com', password: 'newpass456' } });
    assert.equal(signin.status, 200);
  });

  it('rejects an expired reset link', async () => {
    await signUp('resetexp@example.com');
    await call('POST', '/api/auth/forgot-password', { body: { email: 'resetexp@example.com' } });
    const { token } = lastMail('resetexp@example.com');
    clockOffset = 31 * 60_000;
    try {
      assert.equal((await call('POST', '/api/auth/reset-password', { body: { token, password: 'newpass456' } })).status, 400);
    } finally {
      clockOffset = 0;
    }
  });

  it('gives no account-existence hint for unknown emails', async () => {
    await signUp('known@example.com');
    const known = await call('POST', '/api/auth/forgot-password', { body: { email: 'known@example.com' } });
    const unknown = await call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@example.com' } });
    assert.equal(known.status, unknown.status);
    assert.deepEqual(known.data, unknown.data);
    assert.equal(lastMail('nobody@example.com'), undefined);
  });
});

describe('refresh tokens', () => {
  const refreshRow = (t) => db.prepare('select * from refresh_tokens where session_token = ?').get(t);

  it('issues a 14-day refresh token stored hashed and revokes it on sign-out', async () => {
    const { token, refreshToken, refreshExpiresAt } = await signUp('refresh@example.com');
    assert.ok(refreshToken);
    const days = (Date.parse(refreshExpiresAt) - Date.now()) / 86_400_000;
    assert.ok(days > 13.9 && days <= 14);
    const row = refreshRow(token);
    assert.notEqual(row.token_hash, refreshToken);
    assert.equal(row.revoked, 0);
    assert.equal((await call('POST', '/api/auth/signout', { token, body: { refreshToken } })).status, 204);
    assert.equal(refreshRow(token).revoked, 1);
  });

  it('revokes all refresh tokens on password reset', async () => {
    const { token } = await signUp('refreshreset@example.com');
    await call('POST', '/api/auth/forgot-password', { body: { email: 'refreshreset@example.com' } });
    const reset = lastMail('refreshreset@example.com').token;
    await call('POST', '/api/auth/reset-password', { body: { token: reset, password: 'newpass456' } });
    assert.equal(refreshRow(token).revoked, 1);
  });
});

describe('edit profile', () => {
  it('updates name and phone, rejecting duplicates with the generic error', async () => {
    const { token } = await signUp('edit@example.com');
    await signUp('edit-other@example.com', '+15557770001');
    const res = await call('PATCH', '/api/auth/me', { token, body: { displayName: 'New Name', phone: '+1 555 777 0002' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.displayName, 'New Name');
    assert.equal(res.data.phone, '+15557770002');
    const dupPhone = await call('PATCH', '/api/auth/me', { token, body: { phone: '+15557770001' } });
    const dupEmail = await call('PATCH', '/api/auth/me', { token, body: { email: 'EDIT-OTHER@example.com' } });
    assert.equal(dupPhone.status, 409);
    assert.deepEqual(dupPhone.data, dupEmail.data);
    assert.equal((await call('PATCH', '/api/auth/me', { token, body: { displayName: ' ' } })).status, 400);
  });

  it('keeps the old email active until the new one is verified', async () => {
    const { token } = await signUp('oldmail@example.com');
    const res = await call('PATCH', '/api/auth/me', { token, body: { email: 'newmail@example.com' } });
    assert.equal(res.status, 200);
    assert.equal(res.data.email, 'oldmail@example.com');
    assert.equal(res.data.pendingEmail, 'newmail@example.com');
    const signinOld = await call('POST', '/api/auth/signin', { body: { email: 'oldmail@example.com', password: 'secret123' } });
    assert.equal(signinOld.status, 200);
    assert.equal((await call('GET', '/api/restaurants', { token })).status, 200);

    assert.equal((await call('POST', '/api/auth/email-change/resend', { token })).status, 429);
    assert.equal((await call('POST', '/api/auth/email-change/verify', { token, body: { code: 'bad' } })).status, 400);
    const ok = await call('POST', '/api/auth/email-change/verify', { token, body: { code: lastMail('newmail@example.com').code } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.email, 'newmail@example.com');
    assert.equal(ok.data.pendingEmail, null);
    assert.equal((await call('POST', '/api/auth/signin', { body: { email: 'oldmail@example.com', password: 'secret123' } })).status, 401);
    assert.equal((await call('POST', '/api/auth/signin', { body: { email: 'newmail@example.com', password: 'secret123' } })).status, 200);
  });

  it('rejects an expired email change code', async () => {
    const { token } = await signUp('expchange@example.com');
    await call('PATCH', '/api/auth/me', { token, body: { email: 'expchange2@example.com' } });
    clockOffset = 16 * 60_000;
    try {
      const res = await call('POST', '/api/auth/email-change/verify', { token, body: { code: lastMail('expchange2@example.com').code } });
      assert.equal(res.status, 400);
    } finally {
      clockOffset = 0;
    }
  });

  it('changes the password with the current one and signs out other sessions', async () => {
    const { token } = await signUp('pwchange@example.com');
    const other = (await call('POST', '/api/auth/signin', { body: { email: 'pwchange@example.com', password: 'secret123' } })).data.token;
    assert.equal((await call('PATCH', '/api/auth/me', { token, body: { currentPassword: 'wrong', password: 'newpass456' } })).status, 400);
    assert.equal((await call('PATCH', '/api/auth/me', { token, body: { currentPassword: 'secret123', password: 'weak' } })).status, 400);
    assert.equal((await call('PATCH', '/api/auth/me', { token, body: { currentPassword: 'secret123', password: 'newpass456' } })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: other })).status, 401);
    assert.equal((await call('POST', '/api/auth/signin', { body: { email: 'pwchange@example.com', password: 'newpass456' } })).status, 200);
  });

  it('keeps friend links after profile changes', async () => {
    const a = await signUp('friendedit-a@example.com');
    const b = await signUp('friendedit-b@example.com');
    const req = await call('POST', '/api/friends', { token: a.token, body: { userId: b.user.id } });
    await call('POST', `/api/friends/${req.data.id}/accept`, { token: b.token });
    await call('PATCH', '/api/auth/me', { token: a.token, body: { displayName: 'Renamed', phone: '+15556660001' } });
    const friends = (await call('GET', '/api/friends', { token: b.token })).data;
    assert.equal(friends[0].user.displayName, 'Renamed');
    const found = (await call('GET', '/api/users?q=%2B15556660001', { token: b.token })).data;
    assert.equal(found[0].id, a.user.id);
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

  it('marking another order as the default makes only that one the default', async () => {
    const { token } = await signUp('switchdefault@example.com');
    const a = await saveOrder(token, 'Cafe', { items: ['Latte'] });
    const b = await saveOrder(token, 'Cafe', { items: ['Mocha'] });
    const res = await call('PATCH', `/api/orders/${b.id}`, { token, body: { isDefault: true } });
    assert.equal(res.status, 200);
    const orders = (await call('GET', `/api/restaurants/${a.restaurantId}/orders`, { token })).data;
    assert.deepEqual(orders.filter((o) => o.isDefault).map((o) => o.id), [b.id]);
    assert.deepEqual((await call('GET', '/api/restaurants', { token })).data[0].defaultItems, ['Mocha']);
  });

  it('editing one order leaves the restaurant and other orders unchanged and bumps its updated time', async () => {
    const { token } = await signUp('editone@example.com');
    const a = await saveOrder(token, 'Grill', { items: ['Steak'], title: 'Date night' });
    const b = await saveOrder(token, 'Grill', { items: ['Burger'], notes: 'Medium' });
    const before = (await call('GET', `/api/restaurants/${a.restaurantId}`, { token })).data;
    await new Promise((r) => setTimeout(r, 5));
    const edited = (await call('PATCH', `/api/orders/${b.id}`, {
      token,
      body: {
        title: 'Lunch',
        notes: 'Well done',
        items: [{ name: 'Burger', quantity: 2, customizations: [{ kind: 'remove', ingredient: 'Pickles' }] }],
      },
    })).data;
    assert.equal(edited.title, 'Lunch');
    assert.equal(edited.notes, 'Well done');
    assert.deepEqual(edited.items, [{ name: 'Burger', quantity: 2, customizations: [{ kind: 'remove', ingredient: 'Pickles' }] }]);
    assert.ok(edited.updatedAt > b.updatedAt);
    assert.equal(edited.restaurantId, a.restaurantId);
    const otherAfter = (await call('GET', `/api/orders/${a.id}`, { token })).data;
    assert.deepEqual(otherAfter, a);
    // Only the activity time may change; the restaurant itself stays the same.
    const after = (await call('GET', `/api/restaurants/${a.restaurantId}`, { token })).data;
    assert.deepEqual({ ...after, updatedAt: undefined }, { ...before, updatedAt: undefined });
    const noItems = await call('PATCH', `/api/orders/${b.id}`, { token, body: { items: [] } });
    assert.equal(noItems.status, 400);
  });

  it('deleting the default promotes the most recently updated remaining order', async () => {
    const { token } = await signUp('promote@example.com');
    const a = await saveOrder(token, 'Sushi', { items: ['Roll A'] });
    const b = await saveOrder(token, 'Sushi', { items: ['Roll B'] });
    await new Promise((r) => setTimeout(r, 5));
    const c = await saveOrder(token, 'Sushi', { items: ['Roll C'] });
    await new Promise((r) => setTimeout(r, 5));
    await call('PATCH', `/api/orders/${b.id}`, { token, body: { notes: 'Extra ginger' } });
    assert.equal((await call('DELETE', `/api/orders/${a.id}`, { token })).status, 204);
    const orders = (await call('GET', `/api/restaurants/${a.restaurantId}/orders`, { token })).data;
    assert.deepEqual(orders.filter((o) => o.isDefault).map((o) => o.id), [b.id]);
    assert.ok(orders.some((o) => o.id === c.id && !o.isDefault));
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

  it('suggests both an administrator-owned and a same-named user-created restaurant', async () => {
    const adminId = addAdminRestaurant(db, 'Twin Grill');
    const { token } = await signUp('twin@example.com');
    const own = await saveOrder(token, 'Twin Grill');
    const res = await call('GET', '/api/restaurant-suggestions?q=twin%20grill', { token });
    assert.deepEqual(res.data.map((r) => r.id).sort(), [adminId, own.restaurantId].sort());
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

  it('returns the toppings list only to a signed-in user', async () => {
    assert.equal((await call('GET', '/api/toppings?q=let')).status, 401);
    const { token } = await signUp('toppings-auth@example.com');
    const res = await call('GET', '/api/toppings?q=let', { token });
    assert.equal(res.status, 200);
    assert.ok(res.data.includes('Lettuce'));
  });

  it('reads toppings seeded and maintained by the administrator', async () => {
    const { token } = await signUp('toppings-admin@example.com');
    addAdminTopping(db, 'Zesty Relish');
    assert.deepEqual((await call('GET', '/api/toppings?q=zesty', { token })).data, ['Zesty Relish']);
    removeAdminTopping(db, 'Zesty Relish');
    assert.deepEqual((await call('GET', '/api/toppings?q=zesty', { token })).data, []);
  });

  it('saves a topping that is not in the list as typed', async () => {
    const { token } = await signUp('toppings-free@example.com');
    const custom = [
      { kind: 'remove', ingredient: 'Mystery Sprinkles' },
      { kind: 'substitute', ingredient: 'Dragon Sauce', insteadOf: 'Moon Mayo' },
    ];
    const o = await saveOrder(token, 'Free Text Grill', { items: [{ name: 'Burger', customizations: custom }] });
    const saved = (await call('GET', `/api/orders/${o.id}`, { token })).data;
    assert.deepEqual(saved.items[0].customizations, custom);
  });

  it('works when the toppings list is empty', async () => {
    const emptyDb = openDatabase(':memory:');
    emptyDb.exec('delete from toppings');
    const emptyMail = [];
    const emptyServer = createApp(emptyDb, { mailer: { send: (m) => emptyMail.push(m) } });
    await new Promise((resolve) => emptyServer.listen(0, resolve));
    const emptyBase = `http://localhost:${emptyServer.address().port}`;
    try {
      const signup = await fetch(`${emptyBase}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'empty@example.com', phone: '+15550009999', displayName: 'Empty', password: 'secret123' }),
      });
      const { token } = await signup.json();
      await fetch(`${emptyBase}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: emptyMail.at(-1).code }),
      });
      const res = await fetch(`${emptyBase}/api/toppings?q=let`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), []);
    } finally {
      emptyServer.close();
    }
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

  async function befriend(a, b) {
    const req = (await call('POST', '/api/friends', { token: a.token, body: { userId: b.user.id } })).data;
    await call('POST', `/api/friends/${req.id}/accept`, { token: b.token });
    return req.id;
  }
  const sharedList = async (token) => (await call('GET', '/api/shared', { token })).data;

  it('shares with several friends at once and prevents duplicates', async () => {
    const a = await signUp('multi-a@example.com');
    const b = await signUp('multi-b@example.com');
    const c = await signUp('multi-c@example.com');
    const stranger = await signUp('multi-d@example.com');
    await befriend(a, b);
    await befriend(c, a);
    const o = await saveOrder(a.token, 'Multi', { items: ['Tea'] });
    const share = (userIds) => call('POST', `/api/orders/${o.id}/shares`, { token: a.token, body: { userIds } });
    assert.equal((await share([b.user.id, stranger.user.id])).status, 403);
    assert.deepEqual(await sharedList(b.token), []);
    const res = await share([b.user.id, c.user.id]);
    assert.equal(res.status, 201);
    assert.equal(res.data.length, 2);
    assert.equal((await share([b.user.id])).status, 409);
    assert.equal((await sharedList(b.token))[0].sharedBy.id, a.user.id);
    assert.equal((await sharedList(c.token))[0].order.id, o.id);
    assert.deepEqual(await sharedList(stranger.token), []);

    const shares = (await call('GET', `/api/orders/${o.id}/shares`, { token: a.token })).data;
    assert.deepEqual(shares.map((s) => s.user.id).sort(), [b.user.id, c.user.id].sort());
    assert.equal((await call('GET', `/api/orders/${o.id}/shares`, { token: b.token })).status, 404);
  });

  it('shows the owner latest version and removes deleted or unshared orders', async () => {
    const a = await signUp('live-a@example.com');
    const b = await signUp('live-b@example.com');
    await befriend(a, b);
    const o = await saveOrder(a.token, 'Live', { items: ['Old'] });
    const shareId = (await call('POST', `/api/orders/${o.id}/shares`, { token: a.token, body: { userId: b.user.id } })).data.id;
    await call('PATCH', `/api/orders/${o.id}`, { token: a.token, body: { items: items('New') } });
    assert.equal((await sharedList(b.token))[0].order.items[0].name, 'New');

    assert.equal((await call('DELETE', `/api/shares/${shareId}`, { token: a.token })).status, 204);
    assert.deepEqual(await sharedList(b.token), []);
    await call('POST', `/api/orders/${o.id}/shares`, { token: a.token, body: { userId: b.user.id } });
    await call('DELETE', `/api/orders/${o.id}`, { token: a.token });
    assert.deepEqual(await sharedList(b.token), []);
  });

  it('saves an independent copy under a matching or new restaurant', async () => {
    const a = await signUp('save-a@example.com');
    const b = await signUp('save-b@example.com');
    await befriend(a, b);
    const mine = await saveOrder(b.token, 'Diner', { items: ['Pie'] });
    const o1 = await saveOrder(a.token, 'Diner', { title: 'Lunch', items: [{ name: 'Burger', quantity: 2 }], notes: 'n' });
    const o2 = await saveOrder(a.token, 'Brand New Place', { items: ['Soup'] });
    await call('POST', `/api/orders/${o1.id}/shares`, { token: a.token, body: { userId: b.user.id } });
    await call('POST', `/api/orders/${o2.id}/shares`, { token: a.token, body: { userId: b.user.id } });
    const list = await sharedList(b.token);
    const shareOf = (id) => list.find((s) => s.order.id === id).shareId;

    const copy1 = await call('POST', `/api/shared/${shareOf(o1.id)}/save`, { token: b.token });
    assert.equal(copy1.status, 201);
    assert.equal(copy1.data.restaurantId, mine.restaurantId);
    assert.equal(copy1.data.ownerId, b.user.id);
    assert.equal(copy1.data.title, 'Lunch');
    assert.equal(copy1.data.items[0].quantity, 2);

    const copy2 = (await call('POST', `/api/shared/${shareOf(o2.id)}/save`, { token: b.token })).data;
    const restaurant = (await call('GET', `/api/restaurants/${copy2.restaurantId}`, { token: b.token })).data;
    assert.equal(restaurant.name, 'Brand New Place');
    assert.equal(restaurant.adminOwned, false);
    assert.notEqual(copy2.restaurantId, o2.restaurantId);

    await call('PATCH', `/api/orders/${o1.id}`, { token: a.token, body: { items: items('Changed') } });
    await call('DELETE', `/api/orders/${o2.id}`, { token: a.token });
    assert.equal((await call('GET', `/api/orders/${copy1.data.id}`, { token: b.token })).data.items[0].name, 'Burger');
    assert.equal((await call('GET', `/api/orders/${copy2.id}`, { token: b.token })).status, 200);
    assert.equal((await call('POST', `/api/shared/${shareOf(o1.id)}/save`, { token: a.token })).status, 404);
  });

  it('unfriending revokes shared orders but keeps saved copies', async () => {
    const a = await signUp('unf-a@example.com');
    const b = await signUp('unf-b@example.com');
    const friendshipId = await befriend(a, b);
    const o = await saveOrder(a.token, 'Unf', { items: ['Wrap'] });
    const back = await saveOrder(b.token, 'Back', { items: ['Taco'] });
    await call('POST', `/api/orders/${o.id}/shares`, { token: a.token, body: { userId: b.user.id } });
    await call('POST', `/api/orders/${back.id}/shares`, { token: b.token, body: { userId: a.user.id } });
    const copy = (await call('POST', `/api/shared/${(await sharedList(b.token))[0].shareId}/save`, { token: b.token })).data;

    assert.equal((await call('DELETE', `/api/friends/${friendshipId}`, { token: a.token })).status, 204);
    assert.deepEqual(await sharedList(b.token), []);
    assert.deepEqual(await sharedList(a.token), []);
    assert.equal((await call('GET', `/api/orders/${o.id}`, { token: b.token })).status, 404);
    assert.equal((await call('GET', `/api/orders/${copy.id}`, { token: b.token })).status, 200);
  });
});

describe('friends', () => {
  const friends = async (token) => (await call('GET', '/api/friends', { token })).data;

  it('searches by exact email or phone, never by name', async () => {
    const a = await signUp('search-a@example.com');
    await call('POST', '/api/auth/signup', { body: { email: 'carol@example.com', password: 'secret123', displayName: 'Carol', phone: '+15550001' } });
    const find = async (q) => (await call('GET', `/api/users?q=${encodeURIComponent(q)}`, { token: a.token })).data;
    assert.deepEqual((await find('CAROL@example.com')).map((u) => u.email), ['carol@example.com']);
    assert.deepEqual((await find('+15550001')).map((u) => u.email), ['carol@example.com']);
    assert.deepEqual(await find('Carol'), []);
    assert.deepEqual(await find('carol@'), []);
    assert.deepEqual(await find(''), []);
  });

  it('sends, accepts and removes friends for both users', async () => {
    const a = await signUp('fa@example.com');
    const b = await signUp('fb@example.com');
    const req = (await call('POST', '/api/friends', { token: a.token, body: { userId: b.user.id } })).data;
    assert.deepEqual((await friends(a.token)).map((f) => [f.status, f.direction, f.user.id]), [['pending', 'outgoing', b.user.id]]);
    assert.deepEqual((await friends(b.token)).map((f) => [f.status, f.direction, f.user.id]), [['pending', 'incoming', a.user.id]]);
    assert.equal((await call('POST', '/api/friends', { token: b.token, body: { userId: a.user.id } })).status, 409);

    assert.equal((await call('POST', `/api/friends/${req.id}/accept`, { token: b.token })).status, 200);
    assert.equal((await friends(a.token))[0].status, 'accepted');
    assert.equal((await friends(b.token))[0].status, 'accepted');

    assert.equal((await call('DELETE', `/api/friends/${req.id}`, { token: b.token })).status, 204);
    assert.deepEqual(await friends(a.token), []);
    assert.deepEqual(await friends(b.token), []);
  });

  it('declines silently so the sender can ask again, and lets the sender cancel', async () => {
    const a = await signUp('da@example.com');
    const b = await signUp('db@example.com');
    const send = () => call('POST', '/api/friends', { token: a.token, body: { userId: b.user.id } });
    const first = (await send()).data;
    assert.equal((await call('DELETE', `/api/friends/${first.id}`, { token: b.token })).status, 204);
    assert.deepEqual(await friends(a.token), []);
    const second = await send();
    assert.equal(second.status, 201);
    assert.equal((await call('DELETE', `/api/friends/${second.data.id}`, { token: a.token })).status, 204);
    assert.deepEqual(await friends(b.token), []);
    const outsider = await signUp('dc@example.com');
    const third = (await send()).data;
    assert.equal((await call('DELETE', `/api/friends/${third.id}`, { token: outsider.token })).status, 404);
  });
});
