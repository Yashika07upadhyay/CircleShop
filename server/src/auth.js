import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'circle-marketplace-secret-key-2026';
const SALT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  // Fallback for unhashed plain-text passwords in demo DB
  if (!stored.startsWith('$2a$') && !stored.startsWith('$2b$')) {
    return password === stored;
  }
  return bcrypt.compareSync(password, stored);
}

export function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    iat: Date.now()
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data;
  } catch {
    return null;
  }
}
