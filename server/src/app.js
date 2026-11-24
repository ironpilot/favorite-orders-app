// HTTP API for Favorite Order App. Access rules mirror the old row-level security:
// users only see their own data plus orders explicitly shared with them by accepted friends.
import { createServer } from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

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

export function createApp(db) {
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

  function issueSession(user) {
    const token = randomBytes(32).toString('hex');
    run('insert into sessions (token, user_id) values (?, ?)', token, user.id);
    return { token, user: publicUser(user) };
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
      const email = requireText(body.email, 'email');
      if (typeof body.password !== 'string' || body.password.length < 6) {
        throw new HttpError(400, 'password must be at least 6 characters');
      }
      if (one('select 1 from users where email = ?', email)) throw new HttpError(409, 'Email already registered');
      const id = randomUUID();
      run(
        'insert into users (id, email, phone, display_name, password_hash) values (?, ?, ?, ?, ?)',
        id, email, body.phone ?? null, typeof body.displayName === 'string' ? body.displayName.trim() : '',
        hashPassword(body.password),
      );
      return [201, issueSession(one('select * from users where id = ?', id))];
    }, false],

    ['POST', '/api/auth/signin', ({ body }) => {
      const user = one('select * from users where email = ?', String(body.email ?? '').trim());
      if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.password_hash)) {
        throw new HttpError(401, 'Invalid email or password');
      }
      return [200, issueSession(user)];
    }, false],

    ['POST', '/api/auth/signout', ({ token }) => {
      run('delete from sessions where token = ?', token);
      return [204];
    }],

    ['GET', '/api/auth/me', ({ user }) => [200, publicUser(user)]],

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
                  (select o.id from orders o where o.restaurant_id = r.id and o.owner_id = ? and o.is_default = 1) as default_order_id
             from restaurants r
            where r.owner_id = ?
               or (r.owner_id is null and exists (select 1 from orders o where o.restaurant_id = r.id and o.owner_id = ?))
         ) order by updated_at desc`,
        user.id, user.id, user.id, user.id, user.id,
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
      return [200, ordersDto(rows)];
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

    // Declines (silent), cancels a pending request, or removes a friend.
    ['DELETE', '/api/friends/:id', ({ user, params }) => {
      const res = run('delete from friendships where id = ? and ? in (requester_id, addressee_id)', params.id, user.id);
      if (res.changes === 0) throw new HttpError(404, 'Friendship not found');
      return [204];
    }],

    // Shares ------------------------------------------------------------------
    ['POST', '/api/orders/:id/shares', ({ user, params, body }) => {
      ownOrder(user.id, params.id);
      const friendId = String(body.userId ?? '');
      if (!areFriends(user.id, friendId)) throw new HttpError(403, 'Orders can only be shared with accepted friends');
      const id = randomUUID();
      try {
        run('insert into order_shares (id, order_id, shared_by, shared_with) values (?, ?, ?, ?)', id, params.id, user.id, friendId);
      } catch {
        throw new HttpError(409, 'Order already shared with this user');
      }
      return [201, { id, orderId: params.id, sharedWith: friendId }];
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
