// SQLite schema for Favorite Order App.
// Orders are private by default; sharing requires an accepted friendship and an explicit share record.
import { DatabaseSync } from 'node:sqlite';

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
create table if not exists restaurants (
  id text primary key,
  owner_id text not null references users (id) on delete cascade,
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
  items text not null default '[]',
  customizations text,
  notes text,
  is_default integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists orders_restaurant_idx on orders (restaurant_id);
-- At most one default order per restaurant.
create unique index if not exists orders_one_default_per_restaurant on orders (restaurant_id) where is_default = 1;

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

export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
