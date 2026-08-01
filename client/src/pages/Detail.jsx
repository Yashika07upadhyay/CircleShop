import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api, money, DEFAULT_PHONE_IMAGE } from '../api/client';
import { Picture } from '../components/Picture';
import { useAuth } from '../context/AuthContext';

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api('/listings/' + id)
      .then((data) => {
        if (isMounted) {
          setItem(data);
          setError('');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.error || 'Listing not found');
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  if (loading) {
    return <main><p className="muted">Loading listing details…</p></main>;
  }

  if (error || !item) {
    return (
      <main>
        <button className="back link-button" onClick={handleBack}>
          ← Back to listings
        </button>
        <p className="error">{error || 'Listing not found'}</p>
      </main>
    );
  }

  const isOwner = user && item.user_id === user.id;
  const isSold = item.status === 'sold';
  const isRemoved = item.status === 'removed';

  return (
    <main className="detail">
      <button className="back link-button" onClick={handleBack}>
        ← Back to where you were
      </button>
      <div className="detail-grid">
        <Picture
          large
          src={item.image_url || (item.category_name === 'Mobile Phones' ? DEFAULT_PHONE_IMAGE : null)}
          icon={item.category_icon}
        />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow">
              {item.category_name} · {item.condition}
            </p>
            {isSold && (
              <span className="pill" style={{ background: '#b02e2e' }}>
                SOLD
              </span>
            )}
            {isRemoved && (
              <span className="pill" style={{ background: '#8a8a8a' }}>
                REMOVED BY SELLER
              </span>
            )}
            {isOwner && (
              <span className="pill" style={{ background: '#315538' }}>
                YOUR LISTING
              </span>
            )}
          </div>

          <h1>{item.title}</h1>
          <div className="price">{money(item.price)}</div>
          <p className="muted">
            Location: {item.location} · Listed by <strong>{item.seller_name || 'Seller'}</strong>
          </p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            {isOwner ? (
              <button className="button" onClick={() => navigate('/dashboard')}>
                Manage in Dashboard
              </button>
            ) : isSold ? (
              <button className="button" disabled style={{ background: '#ccc', cursor: 'not-allowed' }}>
                Item Sold Out
              </button>
            ) : isRemoved ? (
              <button className="button" disabled style={{ background: '#ccc', cursor: 'not-allowed' }}>
                No longer available
              </button>
            ) : (
              <>
                <button
                  className="button"
                  onClick={() => {
                    if (!user) return navigate('/login');
                    navigate('/checkout/' + item.id);
                  }}
                >
                  Buy Now
                </button>
                <button
                  className="button"
                  style={{ background: '#eef5e9', color: 'var(--forest)', border: '1px solid var(--forest)' }}
                  onClick={() => {
                    if (!user) return navigate('/login');
                    navigate('/messages', {
                      state: {
                        listing: {
                          id: item.id,
                          title: item.title,
                          seller_id: item.user_id,
                          seller_name: item.seller_name
                        }
                      }
                    });
                  }}
                >
                  Message Seller
                </button>
              </>
            )}
          </div>

          <hr />
          <h2>About this item</h2>
          <p>{item.description}</p>
          <h2>Details & Category Specifications</h2>
          <dl>
            {(item.attributes || []).map((a) => (
              <React.Fragment key={a.key}>
                <dt>{a.label}</dt>
                <dd>{Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </div>
    </main>
  );
}
