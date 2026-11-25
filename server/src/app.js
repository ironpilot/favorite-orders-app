// HTTP API for Favorite Order App. Access rules mirror the old row-level security:
// users only see their own data plus orders explicitly shared with them by accepted friends.
import { createServer } from 'node:http';
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

function publicUser(u) {
  return { id: u.id, email: u.email, phone: u.phone, displayName: u.display_name };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const VERIFICATION_TTL_MS = 15 * 60 * 1000;
export const RESET_TTL_MS = 30 * 60 * 1000;
export const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const RESEND_PER_MINUTE = 1;
export const RESEND_PER_HOUR = 5;
export const RESET_REQUESTED_MESSAGE = 'If an account exists for this email, a reset link has been sent';

// Default mailer logs messages; production deployments pass a real one to createApp.
const consoleMailer = { send: ({ to, subject, text }) => console.log(`[mail] to=${to} subject=${subject}\n${text}`) };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DUPLICATE_ACCOUNT_MESSAGE =
  'An account is already registered with this email or phone number. Try signing in instead.';

// Phone numbers are stored digits-only with an optional leading +, so formatting differences still collide.
function normalizePhone(value) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'Phone is required');
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number');
  return phone;
}

function validatePassword(password) {
  if (typeof password !== 'string' || !password) throw new HttpError(400, 'Password is required');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must be at least 8 characters and contain letters and numbers');
  }
}

export const LIMITS = { restaurantName: 100, title: 100, itemName: 100, ingredient: 60, notes: 1000 };
const CUSTOMIZATION_KINDS = ['remove', 'add', 'substitute'];

function restaurantDto(r) {
  return { id: r.id, name: r.name, adminOwned: r.owner_id === null, updatedAt: r.updated_at };
}

function orderDto(o, items) {
  return {
    id: o.id,
    ownerId: o.owner_id,
    restaurantId: o.restaurant_id,
    title: o.title,
    items,
    notes: o.notes,
    isDefault: o.is_default === 1,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

function requireText(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${field} is required`);
  const text = value.trim();
  if (max && text.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return text;
}

function optionalText(value, field, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return text || null;
}

// Validates and normalizes an order's items. An order needs at least one item;
// quantity defaults to 1 and must be a whole number of at least 1.
function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'An order needs at least one item');
  return items.map((item, i) => {
    if (!item || typeof item !== 'object') throw new HttpError(400, `items[${i}] is invalid`);
    const name = requireText(item.name, `items[${i}].name`, LIMITS.itemName);
    const quantity = item.quantity === undefined || item.quantity === null ? 1 : item.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new HttpError(400, `items[${i}].quantity must be a whole number of at least 1`);
    }
    const custom = item.customizations ?? [];
    if (!Array.isArray(custom)) throw new HttpError(400, `items[${i}].customizations must be a list`);
    const customizations = custom.map((c, j) => {
      const field = `items[${i}].customizations[${j}]`;
      if (!c || !CUSTOMIZATION_KINDS.includes(c.kind)) {
        throw new HttpError(400, `${field}.kind must be one of ${CUSTOMIZATION_KINDS.join(', ')}`);
      }
      const result = { kind: c.kind, ingredient: requireText(c.ingredient, `${field}.ingredient`, LIMITS.ingredient) };
      if (c.kind === 'substitute') result.insteadOf = requireText(c.insteadOf, `${field}.insteadOf`, LIMITS.ingredient);
      return result;
    });
    return { name, quantity, customizations };
  });
}

export function createApp(db, options = {}) {
  const mailer = options.mailer ?? consoleMailer;
  const clock = options.clock ?? (() => Date.now());
  const appUrl = options.appUrl ?? process.env.APP_URL ?? 'http://localhost:5173';
  const now = () => new Date().toISOString();
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);

  function areFriends(a, b) {
    return !!one(
      `select 1 from friendships where status = 'accepted'
         and ((requester_id = ? and addressee_id = ?) or (requester_id = ? and addressee_id = ?))`,
      a, b, b, a,
    );
  }

  // Users can see their own restaurants and administrator-owned ones (null owner).
  function visibleRestaurant(userId, id) {
    const r = one('select * from restaurants where id = ? and (owner_id = ? or owner_id is null)', id, userId);
    if (!r) throw new HttpError(404, 'Restaurant not found');
    return r;
  }

  // Only user-created restaurants can be renamed or removed by their owner.
  function ownRestaurant(userId, id) {
    const r = visibleRestaurant(userId, id);
    if (r.owner_id === null) throw new HttpError(403, 'Administrator-owned restaurants cannot be changed');
    return r;
  }

  function ownOrder(userId, id) {
    const o = one('select * from orders where id = ? and owner_id = ?', id, userId);
    if (!o) throw new HttpError(404, 'Order not found');
    return o;
  }

  function loadItems(orderIds) {
    const byOrder = new Map(orderIds.map((id) => [id, []]));
    if (orderIds.length === 0) return byOrder;
    const marks = orderIds.map(() => '?').join(',');
    const items = all(`select * from order_items where order_id in (${marks}) order by position`, ...orderIds);
    const byItem = new Map();
    for (const it of items) {
      const dto = { name: it.name, quantity: it.quantity, customizations: [] };
      byItem.set(it.id, dto);
      byOrder.get(it.order_id).push(dto);
    }
    if (items.length > 0) {
      const itemMarks = items.map(() => '?').join(',');
      const customs = all(
        `select * from order_item_customizations where item_id in (${itemMarks}) order by position`,
        ...items.map((it) => it.id),
      );
      for (const c of customs) {
        byItem.get(c.item_id).customizations.push(
          c.kind === 'substitute'
            ? { kind: c.kind, ingredient: c.ingredient, insteadOf: c.instead_of }
            : { kind: c.kind, ingredient: c.ingredient },
        );
      }
    }
    return byOrder;
  }

  function ordersDto(rows) {
    const items = loadItems(rows.map((o) => o.id));
    return rows.map((o) => orderDto(o, items.get(o.id)));
  }

  const orderById = (id) => ordersDto([one('select * from orders where id = ?', id)])[0];

  function writeItems(orderId, items) {
    run('delete from order_items where order_id = ?', orderId);
    items.forEach((item, i) => {
      const itemId = randomUUID();
      run('insert into order_items (id, order_id, position, name, quantity) values (?, ?, ?, ?, ?)',
        itemId, orderId, i, item.name, item.quantity);
      item.customizations.forEach((c, j) => {
        run(
          `insert into order_item_customizations (id, item_id, position, kind, ingredient, instead_of)
           values (?, ?, ?, ?, ?, ?)`,
          randomUUID(), itemId, j, c.kind, c.ingredient, c.insteadOf ?? null,
        );
      });
    });
  }

  function latestVerification(userId) {
    return one(
      'select * from email_verifications where user_id = ? and invalidated = 0 order by created_at desc limit 1',
      userId,
    );
  }

  function latestEmailChange(userId) {
    return one(
      'select * from email_changes where user_id = ? and invalidated = 0 order by created_at desc limit 1',
      userId,
    );
  }

  function accountDto(u) {
    const pending = u.email_verified_at ? null : latestVerification(u.id);
    const change = latestEmailChange(u.id);
    return {
      ...publicUser(u),
      emailVerified: !!u.email_verified_at,
      verificationExpiresAt: pending ? new Date(pending.expires_at).toISOString() : null,
      pendingEmail: change ? change.new_email : null,
      pendingEmailExpiresAt: change ? new Date(change.expires_at).toISOString() : null,
    };
  }

  // Sends a 6-digit code to the new address; the old email stays active until it is confirmed.
  function sendEmailChange(user, newEmail) {
    const t = clock();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = t + VERIFICATION_TTL_MS;
    run('update email_changes set invalidated = 1 where user_id = ?', user.id);
    run(
      'insert into email_changes (id, user_id, new_email, code_hash, expires_at, created_at) values (?, ?, ?, ?, ?, ?)',
      randomUUID(), user.id, newEmail, sha256(code), expiresAt, t,
    );
    mailer.send({
      to: newEmail,
      subject: 'Confirm your new email',
      text: `Your Favorite Order email change code is ${code}. It expires at ${new Date(expiresAt).toISOString()} (15 minutes).`,
      code,
    });
  }

  function checkResendLimits(table, userId) {
    const t = clock();
    const count = (since) => one(
      `select count(*) as n from ${table} where user_id = ? and created_at > ?`, userId, since,
    ).n;
    if (count(t - 60_000) >= RESEND_PER_MINUTE) throw new HttpError(429, 'Please wait a minute before requesting another code');
    if (count(t - 3_600_000) >= RESEND_PER_HOUR) throw new HttpError(429, 'Too many codes requested; try again later');
  }

  const emailTaken = (email, userId) => !!one('select 1 from users where email = ? and id <> ?', email, userId);

  // Sends a fresh 6-digit code valid for 15 minutes; it invalidates any earlier code.
  function sendVerification(user) {
    const t = clock();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = t + VERIFICATION_TTL_MS;
    run('update email_verifications set invalidated = 1 where user_id = ?', user.id);
    run(
      'insert into email_verifications (id, user_id, code_hash, expires_at, created_at) values (?, ?, ?, ?, ?)',
      randomUUID(), user.id, sha256(code), expiresAt, t,
    );
    mailer.send({
      to: user.email,
      subject: 'Your verification code',
      text: `Your Favorite Order verification code is ${code}. It expires at ${new Date(expiresAt).toISOString()} (15 minutes).`,
      code,
    });
  }

  function issueSession(user) {
    const token = randomBytes(32).toString('hex');
    run('insert into sessions (token, user_id) values (?, ?)', token, user.id);
    const refreshToken = randomBytes(32).toString('hex');
    const refreshExpiresAt = clock() + REFRESH_TTL_MS;
    run('insert into refresh_tokens (token_hash, user_id, session_token, expires_at) values (?, ?, ?, ?)',
      sha256(refreshToken), user.id, token, refreshExpiresAt);
    return { token, refreshToken, refreshExpiresAt: new Date(refreshExpiresAt).toISOString(), user: accountDto(user) };
  }

  function withTransaction(fn) {
    db.exec('begin');
    try {
      const result = fn();
      db.exec('commit');
      return result;
    } catch (e) {
      db.exec('rollback');
      throw e;
    }
  }

  // A restaurant's first order becomes its default. Any owner id sent by the client is ignored.
  function insertOrder(userId, restaurantId, body, transactional = true) {
    const id = randomUUID();
    const items = parseItems(body.items);
    const title = optionalText(body.title, 'title', LIMITS.title) ?? '';
    const notes = optionalText(body.notes, 'notes', LIMITS.notes);
    const write = () => {
      const hasOrders = !!one('select 1 from orders where restaurant_id = ? and owner_id = ?', restaurantId, userId);
      const isDefault = body.isDefault === true || !hasOrders;
      if (isDefault) run('update orders set is_default = 0 where restaurant_id = ? and owner_id = ?', restaurantId, userId);
      run(
        `insert into orders (id, owner_id, restaurant_id, title, notes, is_default)
         values (?, ?, ?, ?, ?, ?)`,
        id, userId, restaurantId, title, notes, isDefault ? 1 : 0,
      );
      writeItems(id, items);
    };
    if (transactional) withTransaction(write);
    else write();
    return orderById(id);
  }

  // [method, pattern, handler, requiresAuth]
  const routes = [
    ['POST', '/api/auth/signup', ({ body }) => {
      const displayName = requireText(body.displayName, 'Name', 100);
      const email = requireText(body.email, 'Email', 254);
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
      const phone = normalizePhone(body.phone);
      validatePassword(body.password);
      // One shared message for email and phone so sign-up never reveals which detail is taken.
      if (one('select 1 from users where email = ? or phone = ?', email, phone)) {
        throw new HttpError(409, DUPLICATE_ACCOUNT_MESSAGE);
      }
      const id = randomUUID();
      try {
        run(
          'insert into users (id, email, phone, display_name, password_hash) values (?, ?, ?, ?, ?)',
          id, email, phone, displayName, hashPassword(body.password),
        );
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message))) throw new HttpError(409, DUPLICATE_ACCOUNT_MESSAGE);
        throw e;
      }
      const created = one('select * from users where id = ?', id);
      sendVerification(created);
      return [201, issueSession(created)];
    }, false],

    ['POST', '/api/auth/signin', ({ body }) => {
      const user = one('select * from users where email = ?', String(body.email ?? '').trim());
      if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.password_hash)) {
        throw new HttpError(401, 'Invalid email or password');
      }
      return [200, issueSession(user)];
    }, false],

    // Signing out revokes the session token and its refresh token; the client also clears them locally.
    ['POST', '/api/auth/signout', ({ token, body }) => {
      run('update refresh_tokens set revoked = 1 where session_token = ? or token_hash = ?',
        token, sha256(String(body.refreshToken ?? '')));
      run('delete from sessions where token = ?', token);
      return [204];
    }, 'unverified'],

    ['GET', '/api/auth/me', ({ user }) => [200, accountDto(user)], 'unverified'],

    // Edit profile. Email and phone stay unique (one generic error). A new email must be confirmed
    // with a code before it replaces the old one. Changing the password needs the current one and
    // signs out the account's other sessions.
    ['PATCH', '/api/auth/me', ({ user, token, body }) => {
      const displayName = body.displayName !== undefined ? requireText(body.displayName, 'Name', 100) : user.display_name;
      const phone = body.phone !== undefined ? normalizePhone(body.phone) : user.phone;
      let newEmail = null;
      if (body.email !== undefined) {
        const email = requireText(body.email, 'Email', 254);
        if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
        if (email.toLowerCase() !== user.email.toLowerCase()) newEmail = email;
      }
      if (body.password !== undefined) {
        if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, user.password_hash)) {
          throw new HttpError(400, 'Current password is incorrect');
        }
        validatePassword(body.password);
      }
      if ((newEmail && emailTaken(newEmail, user.id))
        || (phone && one('select 1 from users where phone = ? and id <> ?', phone, user.id))) {
        throw new HttpError(409, DUPLICATE_ACCOUNT_MESSAGE);
      }
      withTransaction(() => {
        try {
          run('update users set display_name = ?, phone = ?, updated_at = ? where id = ?', displayName, phone, now(), user.id);
        } catch (e) {
          if (/UNIQUE/i.test(String(e?.message))) throw new HttpError(409, DUPLICATE_ACCOUNT_MESSAGE);
          throw e;
        }
        if (body.password !== undefined) {
          run('update users set password_hash = ? where id = ?', hashPassword(body.password), user.id);
          run('update refresh_tokens set revoked = 1 where user_id = ? and session_token <> ?', user.id, token);
          run('delete from sessions where user_id = ? and token <> ?', user.id, token);
        }
      });
      const updated = one('select * from users where id = ?', user.id);
      if (newEmail) sendEmailChange(updated, newEmail);
      return [200, accountDto(updated)];
    }],

    ['POST', '/api/auth/email-change/verify', ({ user, body }) => {
      const code = String(body.code ?? '').trim();
      const c = latestEmailChange(user.id);
      if (!code || !c || c.code_hash !== sha256(code)) throw new HttpError(400, 'Invalid verification code');
      if (c.expires_at <= clock()) throw new HttpError(400, 'Verification code has expired; request a new one');
      if (emailTaken(c.new_email, user.id)) throw new HttpError(409, DUPLICATE_ACCOUNT_MESSAGE);
      run('update users set email = ?, updated_at = ? where id = ?', c.new_email, now(), user.id);
      run('update email_changes set invalidated = 1 where user_id = ?', user.id);
      return [200, accountDto(one('select * from users where id = ?', user.id))];
    }],

    // Same limits as sign-up verification: 1 per minute, 5 per hour.
    ['POST', '/api/auth/email-change/resend', ({ user }) => {
      const c = latestEmailChange(user.id);
      if (!c) throw new HttpError(400, 'No email change is pending');
      checkResendLimits('email_changes', user.id);
      sendEmailChange(user, c.new_email);
      return [200, accountDto(user)];
    }],

    ['DELETE', '/api/auth/email-change', ({ user }) => {
      run('update email_changes set invalidated = 1 where user_id = ?', user.id);
      return [200, accountDto(user)];
    }],

    ['POST', '/api/auth/verify', ({ user, body }) => {
      if (user.email_verified_at) return [200, accountDto(user)];
      const code = String(body.code ?? '').trim();
      const v = latestVerification(user.id);
      if (!code || !v || v.code_hash !== sha256(code)) throw new HttpError(400, 'Invalid verification code');
      if (v.expires_at <= clock()) throw new HttpError(400, 'Verification code has expired; request a new one');
      run('update users set email_verified_at = ?, updated_at = ? where id = ?', now(), now(), user.id);
      run('update email_verifications set invalidated = 1 where user_id = ?', user.id);
      return [200, accountDto(one('select * from users where id = ?', user.id))];
    }, 'unverified'],

    // Resending is limited to 1 per minute and 5 per hour.
    ['POST', '/api/auth/resend-verification', ({ user }) => {
      if (user.email_verified_at) throw new HttpError(400, 'Email is already verified');
      checkResendLimits('email_verifications', user.id);
      sendVerification(user);
      return [200, accountDto(user)];
    }, 'unverified'],

    // Always answers the same way so the response never reveals whether an account exists.
    ['POST', '/api/auth/forgot-password', ({ body }) => {
      const email = String(body.email ?? '').trim();
      const user = email && one('select * from users where email = ?', email);
      if (user && user.email_verified_at) {
        const token = randomBytes(32).toString('hex');
        run('update password_resets set used = 1 where user_id = ?', user.id);
        run('insert into password_resets (token_hash, user_id, expires_at) values (?, ?, ?)',
          sha256(token), user.id, clock() + RESET_TTL_MS);
        const link = `${appUrl}/reset-password?token=${token}`;
        mailer.send({
          to: user.email,
          subject: 'Reset your password',
          text: `Reset your Favorite Order password within 30 minutes: ${link}`,
          link,
          token,
        });
      }
      return [202, { message: RESET_REQUESTED_MESSAGE }];
    }, false],

    // A reset link works once; using it signs the account out everywhere.
    ['POST', '/api/auth/reset-password', ({ body }) => {
      const r = one('select * from password_resets where token_hash = ?', sha256(String(body.token ?? '')));
      if (!r || r.used || r.expires_at <= clock()) throw new HttpError(400, 'This reset link is invalid or has expired');
      validatePassword(body.password);
      withTransaction(() => {
        run('update users set password_hash = ?, updated_at = ? where id = ?', hashPassword(body.password), now(), r.user_id);
        run('update password_resets set used = 1 where user_id = ?', r.user_id);
        run('delete from sessions where user_id = ?', r.user_id);
        run('update refresh_tokens set revoked = 1 where user_id = ?', r.user_id);
      });
      return [204];
    }, false],

    // Users can look up others by exact email or phone (never by name) to send friend requests.
    ['GET', '/api/users', ({ user, query }) => {
      const q = (query.get('q') ?? '').trim();
      if (!q) return [200, []];
      const rows = all(
        `select * from users where id <> ? and (email = ? collate nocase or phone = ?) limit 20`,
        user.id, q, q,
      );
      return [200, rows.map(publicUser)];
    }],

    // Restaurants -------------------------------------------------------------
    // The list holds the user's own restaurants plus administrator-owned ones where they saved an order.
    // For administrator-owned restaurants, "updated" reflects only this user's orders.
    ['GET', '/api/restaurants', ({ user }) => {
      const rows = all(
        `select * from (
           select r.id, r.name, r.owner_id,
                  case when r.owner_id is null
                       then (select max(o.updated_at) from orders o where o.restaurant_id = r.id and o.owner_id = ?)
                       else r.updated_at end as updated_at,
                  (select count(*) from orders o where o.restaurant_id = r.id and o.owner_id = ?) as order_count,
                  (select o.id from orders o where o.restaurant_id = r.id and o.owner_id = ? and o.is_default = 1) as default_order_id,
                  exists (select 1 from orders o join order_shares s on s.order_id = o.id
                           where o.restaurant_id = r.id and o.owner_id = ?) as shared
             from restaurants r
            where r.owner_id = ?
               or (r.owner_id is null and exists (select 1 from orders o where o.restaurant_id = r.id and o.owner_id = ?))
         ) order by updated_at desc`,
        user.id, user.id, user.id, user.id, user.id, user.id,
      );
      const defaults = loadItems(rows.map((r) => r.default_order_id).filter(Boolean));
      // Distinct item names across all of the user's orders at each restaurant, for search.
      const itemNames = new Map();
      for (const { restaurant_id: rid, name } of all(
        `select distinct o.restaurant_id, i.name from order_items i join orders o on o.id = i.order_id
          where o.owner_id = ?`,
        user.id,
      )) {
        if (!itemNames.has(rid)) itemNames.set(rid, []);
        itemNames.get(rid).push(name);
      }
      return [200, rows.map((r) => ({
        id: r.id,
        name: r.name,
        orderCount: r.order_count,
        defaultItems: r.default_order_id ? defaults.get(r.default_order_id).map((i) => i.name) : [],
        itemNames: itemNames.get(r.id) ?? [],
        adminOwned: r.owner_id === null,
        shared: Boolean(r.shared),
        updatedAt: r.updated_at,
      }))];
    }],

    // Auto-fill for the add-order flow: administrator-owned and the user's own restaurants.
    ['GET', '/api/restaurant-suggestions', ({ user, query }) => {
      const q = `%${(query.get('q') ?? '').trim()}%`;
      const rows = all(
        `select * from restaurants where (owner_id = ? or owner_id is null) and name like ?
          order by lower(name), owner_id is null limit 10`,
        user.id, q,
      );
      return [200, rows.map(restaurantDto)];
    }],

    // Auto-fill for customizations: administrator-maintained toppings (table `toppings`, seeded
    // outside the app) plus ingredients the user used before. Suggestions never restrict input.
    ['GET', '/api/toppings', ({ user, query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase();
      const used = all(
        `select distinct c.ingredient as name from order_item_customizations c
           join order_items i on i.id = c.item_id join orders o on o.id = i.order_id
          where o.owner_id = ?
         union
         select distinct c.instead_of from order_item_customizations c
           join order_items i on i.id = c.item_id join orders o on o.id = i.order_id
          where o.owner_id = ? and c.instead_of is not null`,
        user.id, user.id,
      ).map((r) => r.name);
      const seen = new Set();
      const result = [];
      const common = all('select name from toppings').map((r) => r.name);
      for (const name of [...used, ...common]) {
        const key = name.toLowerCase();
        if (seen.has(key) || !key.includes(q)) continue;
        seen.add(key);
        result.push(name);
      }
      return [200, result.sort((a, b) => a.localeCompare(b)).slice(0, 10)];
    }],

    ['GET', '/api/restaurants/:id', ({ user, params }) => [200, restaurantDto(visibleRestaurant(user.id, params.id))]],

    ['PATCH', '/api/restaurants/:id', ({ user, params, body }) => {
      ownRestaurant(user.id, params.id);
      run('update restaurants set name = ?, updated_at = ? where id = ?', requireText(body.name, 'name', LIMITS.restaurantName), now(), params.id);
      return [200, { id: params.id, name: body.name.trim() }];
    }],

    // Removing a restaurant that still has orders requires ?confirm=true.
    ['DELETE', '/api/restaurants/:id', ({ user, params, query }) => {
      ownRestaurant(user.id, params.id);
      const { n } = one('select count(*) as n from orders where restaurant_id = ?', params.id);
      if (n > 0 && query.get('confirm') !== 'true') {
        throw new HttpError(409, 'Restaurant has orders; confirm removal');
      }
      run('delete from restaurants where id = ?', params.id);
      return [204];
    }],

    // Orders ------------------------------------------------------------------
    ['GET', '/api/restaurants/:id/orders', ({ user, params }) => {
      visibleRestaurant(user.id, params.id);
      const rows = all('select * from orders where restaurant_id = ? and owner_id = ? order by updated_at desc', params.id, user.id);
      const sharedIds = new Set(all(
        `select distinct s.order_id from order_shares s join orders o on o.id = s.order_id
          where o.restaurant_id = ? and o.owner_id = ?`,
        params.id, user.id,
      ).map((r) => r.order_id));
      return [200, ordersDto(rows).map((o) => ({ ...o, shared: sharedIds.has(o.id) }))];
    }],

    ['POST', '/api/restaurants/:id/orders', ({ user, params, body }) => {
      visibleRestaurant(user.id, params.id);
      return [201, insertOrder(user.id, params.id, body)];
    }],

    // Restaurants are created only by saving an order. Picking a suggestion sends restaurantId
    // (administrator-owned or the user's own). A typed name is matched exactly against the user's own
    // restaurants; otherwise a new user-created restaurant is made. Different spellings stay separate.
    ['POST', '/api/orders', ({ user, body }) => {
      if (body.restaurantId !== undefined && body.restaurantId !== null) {
        const r = visibleRestaurant(user.id, String(body.restaurantId));
        return [201, insertOrder(user.id, r.id, body)];
      }
      const name = requireText(body.restaurantName, 'restaurantName', LIMITS.restaurantName);
      parseItems(body.items);
      const order = withTransaction(() => {
        let r = one('select id from restaurants where owner_id = ? and name = ?', user.id, name);
        if (!r) {
          r = { id: randomUUID() };
          run('insert into restaurants (id, owner_id, name) values (?, ?, ?)', r.id, user.id, name);
        }
        return insertOrder(user.id, r.id, body, false);
      });
      return [201, order];
    }],

    ['GET', '/api/orders/:id', ({ user, params }) => {
      const o = one(
        `select o.* from orders o where o.id = ? and (o.owner_id = ?
           or exists (select 1 from order_shares s where s.order_id = o.id and s.shared_with = ?))`,
        params.id, user.id, user.id,
      );
      if (!o) throw new HttpError(404, 'Order not found');
      return [200, ordersDto([o])[0]];
    }],

    // Orders cannot be moved to another restaurant (v1); the owner id cannot be changed either.
    ['PATCH', '/api/orders/:id', ({ user, params, body }) => {
      const o = ownOrder(user.id, params.id);
      if (body.restaurantId !== undefined && body.restaurantId !== o.restaurant_id) {
        throw new HttpError(400, 'An order cannot be moved to a different restaurant');
      }
      if (body.restaurantName !== undefined) {
        throw new HttpError(400, 'An order cannot be moved to a different restaurant');
      }
      const items = body.items !== undefined ? parseItems(body.items) : null;
      const title = body.title !== undefined ? optionalText(body.title, 'title', LIMITS.title) ?? '' : o.title;
      const notes = body.notes !== undefined ? optionalText(body.notes, 'notes', LIMITS.notes) : o.notes;
      withTransaction(() => {
        if (body.isDefault === true) {
          run('update orders set is_default = 0 where restaurant_id = ? and owner_id = ?', o.restaurant_id, user.id);
        }
        run(
          'update orders set title = ?, notes = ?, is_default = ?, updated_at = ? where id = ?',
          title, notes,
          body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : o.is_default,
          now(), o.id,
        );
        if (items) writeItems(o.id, items);
      });
      return [200, orderById(o.id)];
    }],

    // Deleting the default order promotes the most recently updated remaining order.
    ['DELETE', '/api/orders/:id', ({ user, params }) => {
      const o = ownOrder(user.id, params.id);
      withTransaction(() => {
        run('delete from orders where id = ?', o.id);
        if (o.is_default === 1) {
          run(
            `update orders set is_default = 1 where id =
               (select id from orders where restaurant_id = ? and owner_id = ?
                 order by updated_at desc, created_at desc limit 1)`,
            o.restaurant_id, user.id,
          );
        }
      });
      return [204];
    }],

    // Friends -----------------------------------------------------------------
    ['GET', '/api/friends', ({ user }) => {
      const rows = all(
        `select f.id, f.status, f.requester_id, u.id as uid, u.email, u.phone, u.display_name
           from friendships f
           join users u on u.id = case when f.requester_id = ? then f.addressee_id else f.requester_id end
          where ? in (f.requester_id, f.addressee_id)`,
        user.id, user.id,
      );
      return [200, rows.map((r) => ({
        id: r.id,
        status: r.status,
        direction: r.requester_id === user.id ? 'outgoing' : 'incoming',
        user: publicUser({ id: r.uid, email: r.email, phone: r.phone, display_name: r.display_name }),
      }))];
    }],

    ['POST', '/api/friends', ({ user, body }) => {
      const addressee = one('select id from users where id = ?', String(body.userId ?? ''));
      if (!addressee) throw new HttpError(404, 'User not found');
      if (addressee.id === user.id) throw new HttpError(400, 'Cannot befriend yourself');
      const id = randomUUID();
      try {
        run('insert into friendships (id, requester_id, addressee_id) values (?, ?, ?)', id, user.id, addressee.id);
      } catch {
        throw new HttpError(409, 'Friend request already exists');
      }
      return [201, { id, status: 'pending' }];
    }],

    ['POST', '/api/friends/:id/accept', ({ user, params }) => {
      const f = one(`select * from friendships where id = ? and addressee_id = ? and status = 'pending'`, params.id, user.id);
      if (!f) throw new HttpError(404, 'Friend request not found');
      run(`update friendships set status = 'accepted', updated_at = ? where id = ?`, now(), f.id);
      return [200, { id: f.id, status: 'accepted' }];
    }],

    // Declines (silent), cancels a pending request, or removes a friend. Removing a friend revokes
    // the orders the two shared with each other; copies already saved are independent and remain.
    ['DELETE', '/api/friends/:id', ({ user, params }) => {
      const f = one('select * from friendships where id = ? and ? in (requester_id, addressee_id)', params.id, user.id);
      if (!f) throw new HttpError(404, 'Friendship not found');
      withTransaction(() => {
        run('delete from friendships where id = ?', f.id);
        run(
          `delete from order_shares where (shared_by = ? and shared_with = ?) or (shared_by = ? and shared_with = ?)`,
          f.requester_id, f.addressee_id, f.addressee_id, f.requester_id,
        );
      });
      return [204];
    }],

    // Shares ------------------------------------------------------------------
    // Shares an order with one friend ({ userId }) or several ({ userIds }). Only accepted friends
    // qualify, and an order cannot be shared twice with the same friend.
    ['POST', '/api/orders/:id/shares', ({ user, params, body }) => {
      ownOrder(user.id, params.id);
      const many = Array.isArray(body.userIds);
      const friendIds = [...new Set((many ? body.userIds : [body.userId]).map((v) => String(v ?? '')))];
      if (friendIds.length === 0) throw new HttpError(400, 'Select at least one friend');
      for (const friendId of friendIds) {
        if (!areFriends(user.id, friendId)) throw new HttpError(403, 'Orders can only be shared with accepted friends');
        if (one('select 1 from order_shares where order_id = ? and shared_with = ?', params.id, friendId)) {
          throw new HttpError(409, 'Order already shared with this user');
        }
      }
      const created = withTransaction(() => friendIds.map((friendId) => {
        const id = randomUUID();
        run('insert into order_shares (id, order_id, shared_by, shared_with) values (?, ?, ?, ?)', id, params.id, user.id, friendId);
        return { id, orderId: params.id, sharedWith: friendId };
      }));
      return [201, many ? created : created[0]];
    }],

    // The owner sees who an order is shared with.
    ['GET', '/api/orders/:id/shares', ({ user, params }) => {
      ownOrder(user.id, params.id);
      const rows = all(
        `select s.id as share_id, s.created_at as shared_at, u.id as uid, u.email, u.phone, u.display_name
           from order_shares s join users u on u.id = s.shared_with
          where s.order_id = ? order by s.created_at`,
        params.id,
      );
      return [200, rows.map((r) => ({
        id: r.share_id,
        sharedAt: r.shared_at,
        user: publicUser({ id: r.uid, email: r.email, phone: r.phone, display_name: r.display_name }),
      }))];
    }],

    // Saves an independent copy of a shared order. The copy goes under a restaurant the recipient can
    // see with the same name (their own first, then administrator-owned), or a new user-created one.
    ['POST', '/api/shared/:id/save', ({ user, params }) => {
      const s = one(
        `select s.order_id, r.name as restaurant_name from order_shares s
           join orders o on o.id = s.order_id join restaurants r on r.id = o.restaurant_id
          where s.id = ? and s.shared_with = ?`,
        params.id, user.id,
      );
      if (!s) throw new HttpError(404, 'Shared order not found');
      const source = orderById(s.order_id);
      const order = withTransaction(() => {
        let r = one(
          `select id from restaurants where (owner_id = ? or owner_id is null) and name = ?
            order by owner_id is null limit 1`,
          user.id, s.restaurant_name,
        );
        if (!r) {
          r = { id: randomUUID() };
          run('insert into restaurants (id, owner_id, name) values (?, ?, ?)', r.id, user.id, s.restaurant_name);
        }
        return insertOrder(user.id, r.id, { title: source.title, notes: source.notes, items: source.items }, false);
      });
      return [201, order];
    }],

    ['GET', '/api/shared', ({ user }) => {
      const rows = all(
        `select o.*, s.id as share_id, s.created_at as shared_at, r.name as restaurant_name,
                u.id as uid, u.email, u.phone, u.display_name
           from order_shares s
           join orders o on o.id = s.order_id
           join restaurants r on r.id = o.restaurant_id
           join users u on u.id = s.shared_by
          where s.shared_with = ? order by s.created_at desc`,
        user.id,
      );
      const items = loadItems(rows.map((r) => r.id));
      return [200, rows.map((r) => ({
        shareId: r.share_id,
        sharedAt: r.shared_at,
        restaurantName: r.restaurant_name,
        sharedBy: publicUser({ id: r.uid, email: r.email, phone: r.phone, display_name: r.display_name }),
        order: orderDto(r, items.get(r.id)),
      }))];
    }],

    ['DELETE', '/api/shares/:id', ({ user, params }) => {
      const res = run('delete from order_shares where id = ? and ? in (shared_by, shared_with)', params.id, user.id);
      if (res.changes === 0) throw new HttpError(404, 'Share not found');
      return [204];
    }],
  ].map(([method, pattern, handler, auth = true]) => {
    const keys = [];
    const regex = new RegExp(
      `^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`,
    );
    return { method, regex, keys, handler, auth };
  });

  async function handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const url = new URL(req.url, 'http://localhost');
    try {
      for (const route of routes) {
        const match = route.method === req.method && url.pathname.match(route.regex);
        if (!match) continue;
        const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
        const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
        let user = null;
        if (route.auth) {
          user = token && one('select u.* from sessions s join users u on u.id = s.user_id where s.token = ?', token);
          if (!user) throw new HttpError(401, 'Not signed in');
          if (route.auth !== 'unverified' && !user.email_verified_at) {
            throw new HttpError(403, 'Email not verified');
          }
        }
        const body = ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        const [status, payload] = route.handler({ user, token, params, query: url.searchParams, body });
        if (payload === undefined) return res.writeHead(status).end();
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(payload));
      }
      throw new HttpError(404, 'Not found');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: status === 500 ? 'Internal server error' : e.message }));
    }
  }

  return createServer(handle);
}
