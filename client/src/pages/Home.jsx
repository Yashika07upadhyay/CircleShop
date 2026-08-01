import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, DEFAULT_PHONE_IMAGE } from '../api/client';
import { Picture } from '../components/Picture';

export function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchListings = async () => {
    try {
      setLoading(true);
      const data = await api('/listings');
      setItems(data);
      setError('');
    } catch (err) {
      setError(err?.error || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  return (
    <main>
      <section className="hero">
        <div>
          <p className="pill">A better secondhand marketplace</p>
          <h1>Great things deserve another story.</h1>
          <p>Thoughtful listings, clear details, and a catalogue that adapts as you grow.</p>
          <Link className="button" to="/sell">
            Start selling
          </Link>
        </div>
        <div className="hero-art">⌁</div>
      </section>

      <section className="section-title">
        <div>
          <p className="eyebrow">Fresh listings</p>
          <h2>Find your next favourite</h2>
        </div>
      </section>

      {loading ? (
        <p className="muted">Loading listings…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : items.length === 0 ? (
        <p className="muted">No listings available right now. Be the first to list something!</p>
      ) : (
        <div className="grid">
          {items.map((x) => (
            <Link
              key={x.id}
              className="card"
              to={'/listing/' + x.id}
              state={{ from: '/' }}
            >
              <Picture
                src={x.image_url || (x.category_name === 'Mobile Phones' ? DEFAULT_PHONE_IMAGE : null)}
                icon={x.category_icon}
              />
              <p className="eyebrow">{x.category_name}</p>
              <h3>{x.title}</h3>
              <strong>{money(x.price)}</strong>
              <small>
                {x.condition} · {x.location}
              </small>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
