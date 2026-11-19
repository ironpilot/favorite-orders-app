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

function orderDto(o) {
  return {
    id: o.id,
    ownerId: o.owner_id,
    restaurantId: o.restaurant_id,
    title: o.title,
    items: JSON.parse(o.items),
    customizations: o.customizations,
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

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${field} is required`);
  return value.trim();
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

  function ownRestaurant(userId, id) {
    const r = one('select * from restaurants where id = ? and owner_id = ?', id, userId);
    if (!r) throw new HttpError(404, 'Restaurant not found');
    return r;
  }

  function ownOrder(userId, id) {
    const o = one('select * from orders where id = ? and owner_id = ?', id, userId);
    if (!o) throw new HttpError(404, 'Order not found');
    return o;
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

    // Users can look up others by name, email, or phone to send friend requests.
    ['GET', '/api/users', ({ user, query }) => {
      const q = `%${(query.get('q') ?? '').trim()}%`;
      const rows = all(
        `select * from users where id <> ? and (display_name like ? or email like ? or phone like ?) limit 20`,
        user.id, q, q, q,
      );
      return [200, rows.map(publicUser)];
    }],

    // Restaurants -------------------------------------------------------------
    ['GET', '/api/restaurants', ({ user }) => {
      const rows = all(
        `select r.id, r.name, r.updated_at,
                (select count(*) from orders o where o.restaurant_id = r.id and o.owner_id = r.owner_id) as order_count,
                (select o.items from orders o where o.restaurant_id = r.id and o.is_default = 1) as default_items
           from restaurants r where r.owner_id = ? order by r.updated_at desc`,
        user.id,
      );
      return [200, rows.map((r) => ({
        id: r.id,
        name: r.name,
        orderCount: r.order_count,
        defaultItems: r.default_items ? JSON.parse(r.default_items) : [],
        updatedAt: r.updated_at,
      }))];
    }],

    ['POST', '/api/restaurants', ({ user, body }) => {
      const id = randomUUID();
      run('insert into restaurants (id, owner_id, name) values (?, ?, ?)', id, user.id, requireText(body.name, 'name'));
      const r = one('select * from restaurants where id = ?', id);
      return [201, { id: r.id, name: r.name, orderCount: 0, defaultItems: [], updatedAt: r.updated_at }];
    }],

    ['PATCH', '/api/restaurants/:id', ({ user, params, body }) => {
      ownRestaurant(user.id, params.id);
      run('update restaurants set name = ?, updated_at = ? where id = ?', requireText(body.name, 'name'), now(), params.id);
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
      ownRestaurant(user.id, params.id);
      const rows = all('select * from orders where restaurant_id = ? order by updated_at desc', params.id);
      return [200, rows.map(orderDto)];
    }],

    ['POST', '/api/restaurants/:id/orders', ({ user, params, body }) => {
      ownRestaurant(user.id, params.id);
      const id = randomUUID();
      withTransaction(() => {
        if (body.isDefault) run('update orders set is_default = 0 where restaurant_id = ?', params.id);
        run(
          `insert into orders (id, owner_id, restaurant_id, title, items, customizations, notes, is_default)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
          id, user.id, params.id, body.title ?? '', JSON.stringify(Array.isArray(body.items) ? body.items : []),
          body.customizations ?? null, body.notes ?? null, body.isDefault ? 1 : 0,
        );
      });
      return [201, orderDto(one('select * from orders where id = ?', id))];
    }],

    ['GET', '/api/orders/:id', ({ user, params }) => {
      const o = one(
        `select o.* from orders o where o.id = ? and (o.owner_id = ?
           or exists (select 1 from order_shares s where s.order_id = o.id and s.shared_with = ?))`,
        params.id, user.id, user.id,
      );
      if (!o) throw new HttpError(404, 'Order not found');
      return [200, orderDto(o)];
    }],

    ['PATCH', '/api/orders/:id', ({ user, params, body }) => {
      const o = ownOrder(user.id, params.id);
      withTransaction(() => {
        if (body.isDefault === true) run('update orders set is_default = 0 where restaurant_id = ?', o.restaurant_id);
        run(
          `update orders set title = ?, items = ?, customizations = ?, notes = ?, is_default = ?, updated_at = ?
           where id = ?`,
          body.title ?? o.title,
          Array.isArray(body.items) ? JSON.stringify(body.items) : o.items,
          body.customizations !== undefined ? body.customizations : o.customizations,
          body.notes !== undefined ? body.notes : o.notes,
          body.isDefault !== undefined ? (body.isDefault ? 1 : 0) : o.is_default,
          now(), o.id,
        );
      });
      return [200, orderDto(one('select * from orders where id = ?', o.id))];
    }],

    ['DELETE', '/api/orders/:id', ({ user, params }) => {
      ownOrder(user.id, params.id);
      run('delete from orders where id = ?', params.id);
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
      const f = one(`select * from friendships where id = ? and addressee_id = ?`, params.id, user.id);
      if (!f) throw new HttpError(404, 'Friend request not found');
      run(`update friendships set status = 'accepted', updated_at = ? where id = ?`, now(), f.id);
      return [200, { id: f.id, status: 'accepted' }];
    }],

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
      return [200, rows.map((r) => ({
        shareId: r.share_id,
        sharedAt: r.shared_at,
        restaurantName: r.restaurant_name,
        sharedBy: publicUser({ id: r.uid, email: r.email, phone: r.phone, display_name: r.display_name }),
        order: orderDto(r),
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
