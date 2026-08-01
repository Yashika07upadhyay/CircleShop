import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles.css';

import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { ProtectedAdmin } from './components/ProtectedAdmin';
import { RequireAuth } from './components/RequireAuth';

import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Detail } from './pages/Detail';
import { Sell } from './pages/Sell';
import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Checkout } from './pages/Checkout';

// React Router doesn't reset scroll position on navigation by default. Without
// this, clicking a nav link while scrolled down on the previous page lands you
// on the new page already scrolled down too — which, combined with a sticky
// header, made it look like the header/nav (and its active-link highlighting)
// had disappeared entirely.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/sell"
          element={
            <RequireAuth>
              <Sell />
            </RequireAuth>
          }
        />
        <Route path="/listing/:id" element={<Detail />} />
        <Route
          path="/admin"
          element={
            <ProtectedAdmin>
              <Admin />
            </ProtectedAdmin>
          }
        />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="/checkout/:id" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
