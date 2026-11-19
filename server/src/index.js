import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? 'data/app.db';

mkdirSync(dirname(dbPath), { recursive: true });
createApp(openDatabase(dbPath)).listen(port, () => {
  console.log(`Favorite Order API listening on http://localhost:${port} (db: ${dbPath})`);
});
