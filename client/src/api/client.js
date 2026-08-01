export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem('circle-session') || 'null');
  } catch {
    return null;
  }
};

export const setSession = (sessionData) => {
  if (sessionData) {
    localStorage.setItem('circle-session', JSON.stringify(sessionData));
  } else {
    localStorage.removeItem('circle-session');
  }
};

// Simple pub-sub so AuthContext can react when the server rejects a stored
// session token (e.g. the DB was reseeded and the user id in the token no
// longer exists). Without this, the header/UI kept claiming "logged in"
// while every authenticated request silently failed with 401.
const sessionExpiredListeners = new Set();
export const onSessionExpired = (fn) => {
  sessionExpiredListeners.add(fn);
  return () => sessionExpiredListeners.delete(fn);
};

export const api = async (path, options = {}) => {
  const session = getSession();
  const res = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { 'x-session-token': session.token } : {}),
      ...options.headers
    }
  });

  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    // A 401 while we *think* we're logged in means the stored token is
    // stale/invalid (deleted user, reseeded DB, tampered token, etc).
    // Clear it so the app stops presenting a logged-in UI it can't back up.
    if (res.status === 401 && session?.token) {
      setSession(null);
      sessionExpiredListeners.forEach((fn) => fn());
    }
    throw data || { error: 'Request failed' };
  }
  return data;
};

export const money = (centsOrSubunits) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format((centsOrSubunits || 0) / 100);

export const DEFAULT_PHONE_IMAGE = 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1100&q=85';
