import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, DEFAULT_PHONE_IMAGE } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const [myListings, setMyListings] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const loadListings = async () => {
    const listings = await api('/listings/my');
    setMyListings(listings);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const listings = await api('/listings/my');
        if (isMounted) setMyListings(listings);
        const orders = await api('/orders');
        if (isMounted) setMyOrders(orders);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const setListingStatus = async (listing, status) => {
    setActionError('');
    setBusyId(listing.id);
    try {
      await api('/listings/' + listing.id, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await loadListings();
    } catch (err) {
      setActionError(err?.error || 'Failed to update listing');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p className="eyebrow">User Account</p>
          <h1>{user?.name}'s Dashboard</h1>
        </div>
        <div className="account" style={{ fontSize: '15px' }}>
          Role: <strong>{user?.role?.toUpperCase()}</strong> · Email: {user?.email}
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading dashboard…</p>
      ) : (
        <>
          <section className="form-section" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>My Published Listings ({myListings.length})</h2>
              <Link to="/sell" className="button" style={{ padding: '8px 16px', fontSize: '13px' }}>
                + Create New Listing
              </Link>
            </div>

            {myListings.length === 0 ? (
              <p className="muted">You haven't listed any items yet.</p>
            ) : (
              <>
                {actionError && <p className="error" style={{ marginBottom: '10px' }}>{actionError}</p>}
                <div className="grid" style={{ marginTop: '18px' }}>
                  {myListings.map((x) => (
                    <div key={x.id} className="card">
                      <div className="product-art">
                        {x.image_url ? (
                          <img src={x.image_url} alt={x.title} />
                        ) : (
                          <span>{x.category_icon || '📦'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className="eyebrow">{x.category_name}</p>
                        <span
                          className="pill"
                          style={{
                            background: x.status === 'sold' ? '#b02e2e' : x.status === 'removed' ? '#8a8a8a' : '#466a4b',
                            fontSize: '10px'
                          }}
                        >
                          {x.status.toUpperCase()}
                        </span>
                      </div>
                      <h3>{x.title}</h3>
                      <strong>{money(x.price)}</strong>
                      <small>{x.condition} · {x.location}</small>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to={'/listing/' + x.id} className="link-button">
                          View PDP →
                        </Link>
                        {x.status === 'active' && (
                          <button
                            type="button"
                            disabled={busyId === x.id}
                            className="link-button"
                            style={{ color: '#b02e2e' }}
                            onClick={() => setListingStatus(x, 'removed')}
                          >
                            {busyId === x.id ? 'Removing…' : 'Remove listing'}
                          </button>
                        )}
                        {x.status === 'removed' && (
                          <button
                            type="button"
                            disabled={busyId === x.id}
                            className="link-button"
                            onClick={() => setListingStatus(x, 'active')}
                          >
                            {busyId === x.id ? 'Relisting…' : 'Relist'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="form-section">
            <h2>Order History & Purchases ({myOrders.length})</h2>
            {myOrders.length === 0 ? (
              <p className="muted">No orders found.</p>
            ) : (
              <div className="order-list">
                {myOrders.map((o) => {
                  const youBought = o.buyer_id === user.id;
                  return (
                    <div key={o.id} className="order-card">
                      <div className="product-art order-thumb">
                        {o.image_url ? <img src={o.image_url} alt={o.listing_title} /> : <span>📦</span>}
                      </div>
                      <div className="order-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong>{o.listing_title}</strong>
                          <span className="pill" style={{ background: youBought ? '#315538' : '#8a5a2b', fontSize: '10px' }}>
                            {youBought ? 'You bought' : 'You sold'}
                          </span>
                        </div>
                        <div className="order-meta">
                          Order #{o.id} · {youBought ? `Seller: ${o.seller_name}` : `Buyer: ${o.buyer_name}`} · Paid via {o.payment_method}
                        </div>
                        <small className="muted">Placed on {new Date(o.created_at).toLocaleDateString()}</small>
                      </div>
                      <div className="order-amount">
                        <div className="order-price">{money(o.amount)}</div>
                        <span className="pill" style={{ background: '#315538', fontSize: '10px' }}>
                          {o.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
