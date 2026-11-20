import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { addAdminRestaurant, openDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? 'data/app.db';

mkdirSync(dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);
// Administrator-owned restaurants are managed outside the app, e.g. ADMIN_RESTAURANTS="Taco Bell,Subway".
for (const name of (process.env.ADMIN_RESTAURANTS ?? '').split(',')) {
  if (name.trim()) addAdminRestaurant(db, name);
}
createApp(db).listen(port, () => {
  console.log(`Favorite Order API listening on http://localhost:${port} (db: ${dbPath})`);
});
