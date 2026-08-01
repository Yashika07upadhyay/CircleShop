import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, setSession, onSessionExpired, api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setSession(session);
  }, [session]);

  // If any API call comes back 401 while we thought we were logged in
  // (stale token, deleted account, reseeded DB), drop out of the logged-in
  // UI immediately instead of leaving the header showing a user that the
  // server no longer recognizes.
  useEffect(() => {
    return onSessionExpired(() => {
      setSessionState(null);
      setSessionExpired(true);
    });
  }, []);

  const login = async (credentials) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    // Immediately persist to localStorage synchronously
    setSession(data);
    setSessionState(data);
    setSessionExpired(false);
    return data;
  };

  const register = async (userData) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    // Immediately persist to localStorage synchronously
    setSession(data);
    setSessionState(data);
    setSessionExpired(false);
    return data;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    }
    setSession(null);
    setSessionState(null);
    setSessionExpired(false);
  };

  const value = {
    user: session?.user || null,
    token: session?.token || null,
    sessionExpired,
    login,
    register,
    logout,
    isAdmin: session?.user?.role === 'admin'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
