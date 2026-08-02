import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [create, setCreate] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const f = new FormData(e.currentTarget);
    const email = (f.get('email') || '').trim();
    const password = f.get('password') || '';
    const name = (f.get('name') || '').trim();

    if (create && !name) {
      return setErr('Empty spaces not allowed.');
    }
    if (!email) {
      return setErr('Empty spaces not allowed.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return setErr('Enter a valid email address.');
    }
    if (!password || !password.trim()) {
      return setErr('Empty spaces not allowed.');
    }
    if (password.length < 6) {
      return setErr('Password must be at least 6 characters.');
    }

    try {
      const data = create
        ? await register({ name, email, password })
        : await login({ email, password });

      const redirectTo = location.state?.from;
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
      } else if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (x) {
      setErr(x?.error || 'Authentication failed');
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Circle account</p>
        <h1>{create ? 'Join the market' : 'Welcome back'}</h1>

        <div className="tabs">
          <button
            type="button"
            className={!create ? 'selected' : ''}
            onClick={() => setCreate(false)}
          >
            Log in
          </button>
          <button
            type="button"
            className={create ? 'selected' : ''}
            onClick={() => setCreate(true)}
          >
            Create account
          </button>
        </div>

        <form className="compact" onSubmit={submit}>
          {create && (
            <input
              name="name"
              required
              pattern=".*\S.*"
              title="Empty spaces not allowed"
              placeholder="Your full name"
            />
          )}
          <input
            name="email"
            required
            type="email"
            pattern=".*\S.*"
            title="Empty spaces not allowed"
            placeholder="Email address"
          />
          <input
            name="password"
            required
            minLength={6}
            type="password"
            pattern=".*\S.*"
            title="Empty spaces not allowed"
            placeholder="Password (6+ characters)"
          />

          <button style={{ marginTop: '12px' }}>
            {create ? 'Create account' : 'Log in'}
          </button>
          {err && <p className="error" style={{ marginTop: '8px' }}>{err}</p>}
        </form>

        {!create && (
          <p className="muted" style={{ fontSize: '12px', marginTop: '14px' }}>
            Every account can both browse and sell — there's no separate buyer/seller
            login. Demo admin: <code>admin@circle.com</code> / <code>admin123</code>.
          </p>
        )}
      </div>
    </main>
  );
}
