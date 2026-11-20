// SQLite schema for Favorite Order App.
// Orders are private by default; sharing requires an accepted friendship and an explicit share record.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const SCHEMA = `
pragma foreign_keys = on;
pragma journal_mode = wal;

create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  phone text,
  display_name text not null default '',
  password_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references users (id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Restaurants are free text and persist independently of their orders.
-- A null owner_id marks an administrator-owned restaurant (read-only for users, shared by everyone).
create table if not exists restaurants (
  id text primary key,
  owner_id text references users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists restaurants_owner_idx on restaurants (owner_id);

create table if not exists orders (
  id text primary key,
  owner_id text not null references users (id) on delete cascade,
  restaurant_id text not null references restaurants (id) on delete cascade,
  title text not null default '',
  notes text,
  is_default integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists orders_restaurant_idx on orders (restaurant_id);
-- At most one default order per user per restaurant (administrator-owned restaurants are shared).
drop index if exists orders_one_default_per_restaurant;
create unique index if not exists orders_one_default_per_owner on orders (restaurant_id, owner_id) where is_default = 1;

-- Each order has one or more items; quantity is at least 1.
create table if not exists order_items (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  position integer not null,
  name text not null check (length(trim(name)) > 0),
  quantity integer not null default 1 check (quantity >= 1)
);
create index if not exists order_items_order_idx on order_items (order_id);

-- Per-item customizations: remove an ingredient, add one, or substitute one for another (insteadOf).
create table if not exists order_item_customizations (
  id text primary key,
  item_id text not null references order_items (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('remove', 'add', 'substitute')),
  ingredient text not null check (length(trim(ingredient)) > 0),
  instead_of text,
  check (kind <> 'substitute' or length(trim(coalesce(instead_of, ''))) > 0)
);
create index if not exists order_item_customizations_item_idx on order_item_customizations (item_id);

-- Bump the restaurant's updated_at whenever its orders change (drives "recently updated" sort).
create trigger if not exists orders_touch_insert after insert on orders begin
  update restaurants set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.restaurant_id;
end;
create trigger if not exists orders_touch_update after update on orders begin
  update restaurants set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.restaurant_id;
end;
create trigger if not exists orders_touch_delete after delete on orders begin
  update restaurants set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = old.restaurant_id;
end;

create table if not exists friendships (
  id text primary key,
  requester_id text not null references users (id) on delete cascade,
  addressee_id text not null references users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique
  on friendships (min(requester_id, addressee_id), max(requester_id, addressee_id));

create table if not exists order_shares (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  shared_by text not null references users (id) on delete cascade,
  shared_with text not null references users (id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (order_id, shared_with)
);
create index if not exists order_shares_shared_with_idx on order_shares (shared_with);
`;

// Older databases stored items as a JSON text list and customizations as one text field.
// Move them into order_items (legacy customizations are appended to notes) and drop the old columns.
function migrateLegacyOrders(db) {
  const columns = db.prepare('pragma table_info(orders)').all().map((c) => c.name);
  if (!columns.includes('items')) return;
  db.exec('begin');
  try {
    const insertItem = db.prepare('insert into order_items (id, order_id, position, name, quantity) values (?, ?, ?, ?, 1)');
    for (const o of db.prepare('select id, items, customizations, notes from orders').all()) {
      let items = [];
      try {
        items = JSON.parse(o.items);
      } catch {
        items = [];
      }
      const names = (Array.isArray(items) ? items : [])
        .map((i) => (typeof i === 'string' ? i : i?.name))
        .filter((n) => typeof n === 'string' && n.trim());
      names.forEach((name, i) => insertItem.run(randomUUID(), o.id, i, name.trim()));
      if (o.customizations && o.customizations.trim()) {
        const notes = [o.notes, o.customizations.trim()].filter(Boolean).join('\n');
        db.prepare('update orders set notes = ? where id = ?').run(notes, o.id);
      }
    }
    db.exec('alter table orders drop column items');
    if (columns.includes('customizations')) db.exec('alter table orders drop column customizations');
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    throw e;
  }
}

// Older databases required an owner for every restaurant; rebuild the table so owner_id can be null.
function migrateRestaurantOwner(db) {
  const owner = db.prepare('pragma table_info(restaurants)').all().find((c) => c.name === 'owner_id');
  if (!owner || owner.notnull === 0) return;
  db.exec('pragma foreign_keys = off');
  db.exec('begin');
  try {
    // Triggers on orders reference restaurants; drop them so the rename does not fail
    // ("error in trigger orders_touch_insert: no such table: main.restaurants"). SCHEMA recreates them.
    db.exec(`
      drop trigger if exists orders_touch_insert;
      drop trigger if exists orders_touch_update;
      drop trigger if exists orders_touch_delete;
      create table restaurants_new (
        id text primary key,
        owner_id text references users (id) on delete cascade,
        name text not null check (length(trim(name)) > 0),
        created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      insert into restaurants_new (id, owner_id, name, created_at, updated_at)
        select id, owner_id, name, created_at, updated_at from restaurants;
      drop table restaurants;
      alter table restaurants_new rename to restaurants;
      create index if not exists restaurants_owner_idx on restaurants (owner_id);
    `);
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    throw e;
  } finally {
    db.exec('pragma foreign_keys = on');
  }
}

/** Adds an administrator-owned restaurant (managed outside the app) unless one with this name exists. */
export function addAdminRestaurant(db, name) {
  const text = String(name ?? '').trim();
  if (!text) throw new Error('Restaurant name is required');
  const existing = db.prepare('select id from restaurants where owner_id is null and name = ?').get(text);
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('insert into restaurants (id, owner_id, name) values (?, null, ?)').run(id, text);
  return id;
}

export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  migrateRestaurantOwner(db);
  db.exec(SCHEMA);
  migrateLegacyOrders(db);
  return db;
}
