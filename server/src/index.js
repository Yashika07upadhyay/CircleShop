import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { validateListing } from './validation.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const sessionUser = (req) => {
  const token = req.header('x-session-token');
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(decoded.id);
  return user || null;
};

const requireRole = (role) => (req, res, next) => {
  const user = sessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: `Access denied. Requires ${allowedRoles.join(' or ')} role.` });
    }
  }
  req.user = user;
  next();
};

const requireAuth = (req, res, next) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
};

const parse = (row) => row && ({
  ...row,
  options: JSON.parse(row.options_json || '[]'),
  rules: JSON.parse(row.rules_json || '{}'),
  placeholder: row.placeholder || '',
  helpText: row.help_text || ''
});

function categorySchema(categoryId) {
  return db.prepare(`
    SELECT f.*, cf.position, cf.required, cf.conditional_json
    FROM category_fields cf
    JOIN fields f ON f.id=cf.field_id
    WHERE cf.category_id=?
    ORDER BY cf.position
  `).all(categoryId)
    .map(r => ({
      ...parse(r),
      required: !!r.required,
      conditional: r.conditional_json ? JSON.parse(r.conditional_json) : null
    }));
}

// Public API Endpoints
app.get('/api/categories', (_, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY name').all());
});

app.get('/api/categories/:id/schema', (req, res) => {
  res.json(categorySchema(req.params.id));
});

app.get('/api/listings', (req, res) => {
  const statusFilter = req.query.status || 'active';
  const query = statusFilter === 'all'
    ? `SELECT l.*, c.name category_name, c.icon category_icon, u.name seller_name
       FROM listings l
       JOIN categories c ON c.id=l.category_id
       LEFT JOIN users u ON u.id=l.user_id
       ORDER BY l.created_at DESC`
    : `SELECT l.*, c.name category_name, c.icon category_icon, u.name seller_name
       FROM listings l
       JOIN categories c ON c.id=l.category_id
       LEFT JOIN users u ON u.id=l.user_id
       WHERE l.status='active'
       ORDER BY l.created_at DESC`;
  res.json(db.prepare(query).all());
});

app.get('/api/listings/my', requireAuth, (req, res) => {
  const listings = db.prepare(`
    SELECT l.*, c.name category_name, c.icon category_icon
    FROM listings l
    JOIN categories c ON c.id=l.category_id
    WHERE l.user_id=?
    ORDER BY l.created_at DESC
  `).all(req.user.id);
  res.json(listings);
});

app.get('/api/listings/:id', (req, res) => {
  const listing = db.prepare(`
    SELECT l.*, c.name category_name, c.icon category_icon, u.name seller_name, u.email seller_email
    FROM listings l
    JOIN categories c ON c.id=l.category_id
    LEFT JOIN users u ON u.id=l.user_id
    WHERE l.id=?
  `).get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  const attributes = db.prepare(`
    SELECT f.key, f.label, f.type, la.value_json
    FROM listing_attributes la
    JOIN fields f ON f.id=la.field_id
    WHERE la.listing_id=?
    ORDER BY f.label
  `).all(req.params.id).map(a => ({ ...a, value: JSON.parse(a.value_json) }));
  res.json({ ...listing, attributes });
});

// Let a seller (or admin) remove their own listing from public browse, or
// relist it. Deliberately a status change, not a hard delete: keeps order
// history and message threads intact, and the homepage already filters to
// status='active' by default so a 'removed' listing simply disappears.
app.patch('/api/listings/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only manage your own listings' });
  }
  if (listing.status === 'sold') {
    return res.status(400).json({ error: 'A sold listing already has a completed order and cannot be changed' });
  }
  const { status } = req.body;
  if (!['active', 'removed'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'active' or 'removed'" });
  }
  db.prepare('UPDATE listings SET status=? WHERE id=?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.id));
});

// Create Listing (Sellers & Admins)
app.post('/api/listings', requireAuth, (req, res) => {
  try {
    const payload = req.body;
    const category = db.prepare('SELECT id FROM categories WHERE id=? AND active=1').get(payload.categoryId);
    if (!category) return res.status(400).json({ error: 'Choose a valid category' });

    const schema = categorySchema(category.id);
    const errors = validateListing(payload, schema);
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please fix the highlighted fields', errors });

    const save = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO listings(user_id, category_id, title, description, price, condition, location, image_url)
        VALUES(?,?,?,?,?,?,?,?)
      `).run(
        req.user.id,
        category.id,
        payload.title.trim(),
        payload.description.trim(),
        Math.round(Number(payload.price) * 100),
        payload.condition,
        payload.location.trim(),
        payload.imageUrl || null
      );

      const ins = db.prepare('INSERT INTO listing_attributes(listing_id,field_id,value_json) VALUES(?,?,?)');
      schema.forEach(f => {
        const value = payload.attributes?.[f.key];
        if (value !== undefined && value !== '') {
          ins.run(r.lastInsertRowid, f.id, JSON.stringify(value));
        }
      });
      return r.lastInsertRowid;
    });

    const id = save();
    res.status(201).json({ id });
  } catch (err) {
    console.error('Listing creation error:', err);
    res.status(500).json({ error: 'Failed to publish listing. Try a smaller image or try again.' });
  }
});

// Interactive Messaging Endpoints
app.get('/api/messages', requireAuth, (req, res) => {
  const messages = db.prepare(`
    SELECT m.*, l.title listing_title, su.name sender_name, ru.name receiver_name
    FROM messages m
    JOIN listings l ON l.id=m.listing_id
    JOIN users su ON su.id=m.sender_id
    JOIN users ru ON ru.id=m.receiver_id
    WHERE m.sender_id=? OR m.receiver_id=?
    ORDER BY m.created_at ASC
  `).all(req.user.id, req.user.id);
  res.json(messages);
});

app.post('/api/messages', requireAuth, (req, res) => {
  const { listingId, receiverId, message } = req.body;
  if (!listingId || !receiverId || !message?.trim()) {
    return res.status(400).json({ error: 'Listing, recipient, and message text are required' });
  }
  const info = db.prepare(`
    INSERT INTO messages(listing_id, sender_id, receiver_id, message)
    VALUES(?,?,?,?)
  `).run(listingId, req.user.id, receiverId, message.trim());
  res.status(201).json({ id: info.lastInsertRowid, success: true });
});

// Interactive Payment & Orders Endpoints
app.post('/api/orders', requireAuth, (req, res) => {
  const { listingId, paymentMethod } = req.body;
  if (!listingId || !paymentMethod) return res.status(400).json({ error: 'Listing ID and payment method are required' });

  const listing = db.prepare('SELECT * FROM listings WHERE id=?').get(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status === 'sold') return res.status(400).json({ error: 'This item has already been sold' });
  if (listing.status === 'removed') return res.status(400).json({ error: 'This listing is no longer available' });
  if (listing.user_id === req.user.id) return res.status(400).json({ error: 'You cannot buy your own listing' });

  const processOrder = db.transaction(() => {
    // Mark listing as sold
    db.prepare("UPDATE listings SET status='sold' WHERE id=?").run(listingId);
    // Create order entry
    const info = db.prepare(`
      INSERT INTO orders(listing_id, buyer_id, seller_id, amount, payment_method, status)
      VALUES(?,?,?,?,?,'completed')
    `).run(listingId, req.user.id, listing.user_id || 1, listing.price, paymentMethod);
    return info.lastInsertRowid;
  });

  const orderId = processOrder();
  res.status(201).json({ orderId, status: 'completed', amount: listing.price });
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, l.title listing_title, l.image_url, su.name seller_name, bu.name buyer_name
    FROM orders o
    JOIN listings l ON l.id=o.listing_id
    JOIN users su ON su.id=o.seller_id
    JOIN users bu ON bu.id=o.buyer_id
    WHERE o.buyer_id=? OR o.seller_id=?
    ORDER BY o.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(orders);
});

// Admin API Endpoints
app.get('/api/admin/catalog', requireRole('admin'), (_, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all()
    .map(c => ({ ...c, fields: categorySchema(c.id) }));
  res.json({
    categories,
    fields: db.prepare('SELECT * FROM fields ORDER BY label').all().map(parse)
  });
});

app.get('/api/admin/users', requireRole('admin'), (_, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

app.post('/api/admin/users', requireRole('admin'), (req, res) => {
  const { name, email, password, role = 'admin' } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const hashedPassword = hashPassword(password);
    const assignedRole = role === 'admin' ? 'admin' : 'user';
    const info = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)')
      .run(name.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole);
    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'An account with that email already exists.' });
  }
});

app.post('/api/admin/categories', requireRole('admin'), (req, res) => {
  const { name, description = '', icon = '◈' } = req.body || {};
  const safeName = (name || '').trim();
  const slug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!safeName || !slug) return res.status(400).json({ error: 'Category name is required' });
  const safeDescription = (description || '').trim();
  const safeIcon = (icon || '').trim() || '◈';
  try {
    const info = db.prepare('INSERT INTO categories(name,slug,description,icon) VALUES(?,?,?,?)').run(safeName, slug, safeDescription, safeIcon);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(info.lastInsertRowid));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A category with that name already exists' });
    }
    console.error('Category creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

// Edit an existing category's name/description/icon, and/or flip it
// active/inactive. Deactivating (rather than hard-deleting) is deliberate:
// existing listings keep a valid category_id and their PDP keeps working,
// while the category disappears from "Sell" and the public browse filter.
app.patch('/api/admin/categories/:id', requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Category not found' });

  const name = req.body.name !== undefined ? req.body.name : current.name;
  const description = req.body.description !== undefined ? req.body.description : current.description;
  const icon = req.body.icon !== undefined ? (req.body.icon || '◈') : current.icon;
  const active = req.body.active !== undefined ? Number(!!req.body.active) : current.active;

  const safeName = (name || '').trim();
  if (!safeName) return res.status(400).json({ error: 'Category name is required' });
  const slug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) return res.status(400).json({ error: 'Category name is required' });

  try {
    db.prepare('UPDATE categories SET name=?, slug=?, description=?, icon=?, active=? WHERE id=?')
      .run(safeName, slug, (description || '').trim(), (icon || '').trim() || '◈', active, req.params.id);
    res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'A category with that name already exists' });
    }
    console.error('Category update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update category' });
  }
});

app.post('/api/admin/fields', requireRole('admin'), (req, res) => {
  const { key, label, type, options = [], rules = {}, placeholder = '', helpText = '' } = req.body || {};
  const safeLabel = (label || '').trim();
  const rawKey = (key || '').trim();
  const safeKey = rawKey.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/(^_|_$)/g, '');

  if (!safeKey || !safeLabel || !type) {
    return res.status(400).json({ error: 'Key, label and type are required' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO fields(key,label,type,options_json,rules_json,placeholder,help_text)
      VALUES(?,?,?,?,?,?,?)
    `).run(safeKey, safeLabel, type, JSON.stringify(options || []), JSON.stringify(rules || {}), (placeholder || '').trim(), (helpText || '').trim());
    res.status(201).json(parse(db.prepare('SELECT * FROM fields WHERE id=?').get(info.lastInsertRowid)));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'This field key already exists' });
    }
    console.error('Field creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create field' });
  }
});

app.patch('/api/admin/fields/:id', requireRole('admin'), (req, res) => {
  const current = db.prepare('SELECT * FROM fields WHERE id=?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Field not found' });

  const parsedCurrent = parse(current);
  const next = {
    ...parsedCurrent,
    ...req.body,
    rules: 'rules' in req.body ? (req.body.rules || {}) : parsedCurrent.rules
  };

  const safeLabel = (next.label || '').trim();
  const rawKey = (next.key || '').trim();
  const safeKey = rawKey.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/(^_|_$)/g, '');

  if (!safeKey || !safeLabel || !next.type) {
    return res.status(400).json({ error: 'Key, label and type are required' });
  }

  try {
    db.prepare(`
      UPDATE fields
      SET key=?, label=?, type=?, options_json=?, rules_json=?, placeholder=?, help_text=?
      WHERE id=?
    `).run(
      safeKey,
      safeLabel,
      next.type,
      JSON.stringify(next.options || []),
      JSON.stringify(next.rules || {}),
      (next.placeholder || '').trim(),
      (next.helpText || next.help_text || '').trim(),
      req.params.id
    );
    res.json(parse(db.prepare('SELECT * FROM fields WHERE id=?').get(req.params.id)));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'That field key already exists' });
    }
    console.error('Field update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update field' });
  }
});

// Delete a reusable field definition. Blocked if it's currently attached to
// any category (remove it from the category's schema first) or if any
// existing listing has stored a value against it — deleting it out from
// under real data would silently corrupt PDPs and schema builders.
app.delete('/api/admin/fields/:id', requireRole('admin'), (req, res) => {
  const field = db.prepare('SELECT * FROM fields WHERE id=?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const inUseByCategories = db.prepare('SELECT COUNT(*) c FROM category_fields WHERE field_id=?').get(req.params.id).c;
  if (inUseByCategories > 0) {
    return res.status(409).json({ error: `Remove "${field.label}" from ${inUseByCategories} categor${inUseByCategories === 1 ? 'y' : 'ies'} before deleting it.` });
  }

  const inUseByListings = db.prepare('SELECT COUNT(*) c FROM listing_attributes WHERE field_id=?').get(req.params.id).c;
  if (inUseByListings > 0) {
    return res.status(409).json({ error: `"${field.label}" has values saved on ${inUseByListings} existing listing(s) and can't be deleted.` });
  }

  db.prepare('DELETE FROM fields WHERE id=?').run(req.params.id);
  res.status(204).end();
});

app.put('/api/admin/categories/:id/fields', requireRole('admin'), (req, res) => {
  const { fields } = req.body;
  if (!Array.isArray(fields)) return res.status(400).json({ error: 'Fields array is required' });

  const save = db.transaction(() => {
    db.prepare('DELETE FROM category_fields WHERE category_id=?').run(req.params.id);
    const insert = db.prepare(`
      INSERT INTO category_fields(category_id, field_id, position, required, conditional_json)
      VALUES(?,?,?,?,?)
    `);
    fields.forEach((f, i) => {
      insert.run(
        req.params.id,
        f.fieldId,
        i,
        Number(!!f.required),
        f.conditional ? JSON.stringify(f.conditional) : null
      );
    });
  });

  save();
  res.json(categorySchema(req.params.id));
});

// Authentication Endpoints
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Empty spaces not allowed.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const hashedPassword = hashPassword(password);
    const info = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)')
      .run(name.trim(), email.toLowerCase().trim(), hashedPassword, 'user');
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id=?').get(info.lastInsertRowid);
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(409).json({ error: 'An account with that email already exists.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const userRow = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase().trim());

  if (!userRow || !verifyPassword(password, userRow.password)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  // Re-hash plain text passwords with bcrypt on login
  if (!userRow.password.startsWith('$2a$') && !userRow.password.startsWith('$2b$')) {
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(password), userRow.id);
  }

  const user = { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role };
  const token = generateToken(user);
  res.json({ token, user });
});

app.post('/api/auth/logout', (_, res) => {
  res.status(204).end();
});

// Serve the built React app in production (e.g. on Render), so the API and
// the frontend run as a single service on one origin — the client's
// relative '/api/...' fetches then just work with no separate URL/CORS
// config needed. In local dev this block is inert: `client/dist` doesn't
// exist until `npm run build` is run, and local dev uses the Vite dev
// server on :5173 with its own proxy instead.
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, _, res, __) => {
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File too large. Please use an image under 4 MB.' });
  }
  res.status(500).json({ error: 'Unexpected server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
