# Circle Market — configurable listing flow

A secondhand marketplace where product categories and their fields are configured as data, not code. Admins define reusable fields, attach them to categories, and the seller flow renders and validates whatever schema comes back — no per-category forms, no code changes to add a new category.

## Stack

| Layer | Choice |
|---|---|
| Client | React + Vite + React Router |
| API | Node.js + Express |
| Database | SQLite (`better-sqlite3`) |
| Auth | Custom signed session token + bcrypt password hashing |

SQLite was chosen for zero-setup local development; the relational model is standard enough to move to Postgres later with no redesign (see *Trade-offs*).

## Run locally

Prerequisite: Node.js 20+.

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the API runs on port 3001, proxied automatically in dev. `npm run seed` is idempotent; delete `server/data/marketplace.db` to reset the sample database, then reseed.

**Demo accounts** (from the seed script):
- Admin: `admin@circle.com` / `admin123`
- Regular user: `seller@circle.com` / `seller123` (any account can both buy and sell — see *Role model* below)

## Demo paths

| Route | What it is |
|---|---|
| `/` | Homepage — all active listings |
| `/sell` | Schema-driven seller listing flow |
| `/listing/:id` | Product detail page |
| `/admin` | Catalog management (categories, fields, schema builder) |
| `/dashboard` | Your listings, orders, and purchases |
| `/messages` | Buyer/seller messaging |

## Architecture

```
React client (Vite)  ──fetch /api/*──►  Express API  ──parameterized SQL──►  SQLite
      │                                       │
DynamicField renders                   validateListing() re-checks
whatever schema loads                  the identical schema server-side
```

The client never hardcodes what a "Mobile Phone" or "Sofa" needs. It fetches a category's field schema (`GET /api/categories/:id/schema`) and a single `DynamicField` component renders each field by its declared type. On submit, the server independently re-validates against that same schema before writing — the client's validation is for UX, the server's is what actually enforces correctness.

## Data model

| Table | Purpose |
|---|---|
| `categories` | The category catalog. `active` flag for soft deactivation. |
| `fields` | Reusable field library — one row per field definition (key, label, type, options, validation rules), independent of any category. |
| `category_fields` | Join table: which fields belong to which category, in what order, whether required there, and any conditional-visibility rule. |
| `listings` | Common data every listing has: title, price, condition, location, status. |
| `listing_attributes` | Category-specific values for one listing, one row per field, value stored as JSON keyed to the field definition. |
| `users` | id, name, email, bcrypt password hash, role (`admin` / `user`). |
| `messages`, `orders` | Buyer/seller messaging and completed purchases. |

The load-bearing relationship is `category_fields`: it's what lets the same `fields` row (say, "RAM") be required on Laptops, optional on Mobile Phones, and absent from Sofas — without three copies of a RAM field and without a line of category-specific code.

## Key design decisions

**Why an EAV-style schema (`fields` / `category_fields` / `listing_attributes`) instead of a JSON column or per-category tables?**
A JSON blob column on `listings` is simpler to write, but the database can't validate structure or enforce that a field exists consistently across listings. A table per category (`mobile_phone_listings`, `laptop_listings`, ...) is exactly what the brief asks *not* to do — every new category becomes a migration and new code. The EAV model trades some query performance (attribute filtering means parsing JSON rather than using an indexed column) for the actual requirement: a new category or field is an admin API call, not a deploy.

**Why two roles (`admin` / `user`) instead of separate buyer/seller/admin accounts?**
Real C2C marketplaces (Circle included) don't gate selling behind an account type — any registered user can list an item. A three-role model was considered and reverted; it added access-control complexity the brief never asked for. The one rule that's actually enforced regardless of role: you can't buy your own listing.

**Why dual validation (client + server) instead of just one?**
Both read the exact same schema object from `/api/categories/:id/schema`, so they can't drift into disagreeing about what's valid — the client applies it as HTML constraints for instant feedback, the server re-checks it independently because the client can never be trusted.

**Why field deletion and category deactivation are guarded, not instant.**
Deleting a field that's attached to a category or has values on real listings would corrupt the schema builder and existing PDPs — blocked server-side with a clear message instead. Deactivating a category is a soft toggle (not a delete) so existing listings never lose a valid category reference.

## Sample data

The seed script creates three categories — Mobile Phones, Laptops, Sofas — with reusable fields covering every input type the brief calls out (text, textarea, number, select, radio, checkbox, date, and a conditional field: Warranty Expiry shown only when Under Warranty = Yes), plus a few sample listings.

## Response time on Railway

Railway's free/hobby tier spins down idle containers, so the first request after inactivity pays a cold-start penalty. SQLite (via `better-sqlite3`) also runs synchronously on the same process handling requests — a slow query blocks the whole event loop — and base64-encoded images inflate response payload size, adding transfer time.

## What would actually change to go live and reduce latency

| Change | Why it helps |
|---|---|
| Always-on paid tier (not free/hobby) | Eliminates cold-start delay on the first request after idle |
| Move images off base64-in-JSON to object storage (S3/Cloudinary) + a CDN | Response payloads shrink dramatically — a listing with a photo currently ships the whole image as text inside the API response instead of a small URL |
| Add `compression` middleware to Express | Free, immediate win — gzips every response with near-zero code change |
| Move SQLite → Postgres, or at least enable WAL mode | `better-sqlite3` is synchronous and blocks Node's single event loop per query; under real concurrent traffic this serializes requests. Postgres (or WAL-mode SQLite as a smaller step) handles concurrent reads/writes properly |
| Add indexes on `listings.category_id`, `listings.user_id`, `listings.status`, `listing_attributes.listing_id` | These are the columns every list/filter query joins or filters on; right now they rely on full table scans, which is fine at seed-data scale and won't be at real scale |
| Cache category schemas client-side (they change rarely) | Avoids refetching the same field schema on every visit to `/sell` |
| Deploy to a region close to your actual users | Railway defaults to a single region; cross-continent requests add real round-trip latency no code change fixes |

## Trade-offs and what's next

This is a demo-scoped build. For production: swap the custom session token for a maintained JWT library with real expiry, move image uploads off inline base64 to object storage, add rate limiting on auth endpoints, and move from SQLite to Postgres for concurrent write load (same relational model, no redesign needed). 

