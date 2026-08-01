import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const navigate = useNavigate();
  const { user, logout, isAdmin, sessionExpired } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <header>
        <Link className="logo" to="/">
          circle<span>market</span>
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Browse
          </NavLink>
          {user && (
            <NavLink to="/sell" className={({ isActive }) => (isActive ? 'active' : '')}>
              Sell Item
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
              Catalog Admin
            </NavLink>
          )}
          {user && (
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </NavLink>
          )}
          {user && (
            <NavLink to="/messages" className={({ isActive }) => (isActive ? 'active' : '')}>
              Messages
            </NavLink>
          )}

          {user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginLeft: '10px',
                paddingLeft: '16px',
                borderLeft: '1px solid var(--line)'
              }}
            >
              <span className="account">
                {user.name} <small>({user.role})</small>
              </span>
              <button className="link-button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </nav>
      </header>
      {sessionExpired && !user && (
        <p className="error" style={{ textAlign: 'center', margin: 0, padding: '10px', background: '#fdecea' }}>
          Your session expired or is no longer valid — please log in again.
        </p>
      )}
    </>
  );
}
