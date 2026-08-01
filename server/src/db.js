import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = join(here, '../data/marketplace.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE,
  description TEXT, icon TEXT DEFAULT '◈', active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS fields (
  id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, type TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]', rules_json TEXT NOT NULL DEFAULT '{}', placeholder TEXT,
  help_text TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS category_fields (
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0, required INTEGER NOT NULL DEFAULT 0,
  conditional_json TEXT, PRIMARY KEY (category_id, field_id)
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), category_id INTEGER NOT NULL REFERENCES categories(id), title TEXT NOT NULL,
  description TEXT NOT NULL, price INTEGER NOT NULL, condition TEXT NOT NULL, location TEXT NOT NULL,
  image_url TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listing_attributes (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES fields(id), value_json TEXT NOT NULL,
  PRIMARY KEY(listing_id, field_id)
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, listing_id INTEGER REFERENCES listings(id),
  sender_id INTEGER NOT NULL REFERENCES users(id), receiver_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id), seller_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL, payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migration checks for existing databases
try {
  const listingCols = db.prepare("PRAGMA table_info(listings)").all().map(c => c.name);
  if (!listingCols.includes('user_id')) {
    db.exec("ALTER TABLE listings ADD COLUMN user_id INTEGER REFERENCES users(id)");
  }
} catch (e) {
  console.warn('Listings migration note:', e.message);
}

try {
  const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
  const isOldThreeRoleSchema = tableSql.includes("'seller'") || tableSql.includes("'customer'");
  const isMissingAdminRole = tableSql && !tableSql.includes("'admin'");

  if (isMissingAdminRole || isOldThreeRoleSchema) {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_new (id, name, email, password, role, created_at)
        SELECT id, name, email, password,
               CASE WHEN role = 'admin' THEN 'admin' ELSE 'user' END,
               created_at
        FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  }
} catch (e) {
  console.warn('User table migration note:', e.message);
}

try {
  db.exec("DELETE FROM category_fields WHERE field_id IN (SELECT id FROM fields WHERE key='purchase_year')");
} catch (e) {
  console.warn('Category fields cleanup note:', e.message);
}
