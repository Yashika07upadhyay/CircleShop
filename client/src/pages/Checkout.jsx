import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, money, DEFAULT_PHONE_IMAGE } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  useEffect(() => {
    api('/listings/' + id)
      .then(setItem)
      .catch((err) => setError(err?.error || 'Listing not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePay = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ listingId: Number(id), paymentMethod })
      });
      setSuccessOrder(order);
    } catch (err) {
      setError(err?.error || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <main><p className="muted">Loading checkout…</p></main>;

  if (error && !item) {
    return (
      <main>
        <p className="error">{error}</p>
        <button className="button" onClick={() => navigate('/')}>
          Return to Marketplace
        </button>
      </main>
    );
  }

  if (item && item.status !== 'active') {
    return (
      <main className="narrow">
        <p className="error">
          {item.status === 'sold' ? 'This item has already been sold.' : 'This listing is no longer available.'}
        </p>
        <button className="button" onClick={() => navigate('/')}>
          Return to Marketplace
        </button>
      </main>
    );
  }

  if (successOrder) {
    return (
      <main className="narrow">
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <p className="eyebrow" style={{ color: 'var(--forest)' }}>Payment Successful</p>
          <h1>Order Confirmed!</h1>
          <p className="muted">
            Thank you, <strong>{user?.name}</strong>! Your payment of <strong>{money(item.price)}</strong> via{' '}
            <strong>{paymentMethod}</strong> has been processed successfully.
          </p>
          <div style={{ margin: '24px 0', padding: '16px', background: '#eef5e9', borderRadius: '10px' }}>
            <div>Order Reference: <strong>#{successOrder.orderId}</strong></div>
            <div>Item Purchased: <strong>{item.title}</strong></div>
            <div>Status: <strong style={{ color: 'var(--forest)' }}>COMPLETED</strong></div>
          </div>
          <button className="button" onClick={() => navigate('/dashboard')}>
            View My Orders in Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="narrow">
      <button className="back link-button" onClick={() => navigate(-1)}>
        ← Back to Product Detail
      </button>
      <p className="eyebrow">Secure Checkout</p>
      <h1>Complete your purchase</h1>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        {/* Order Details & Payment Selection */}
        <section className="panel">
          <h2>Payment Method</h2>
          <form onSubmit={handlePay} className="compact">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
              {[
                ['UPI', 'Instant UPI / QR Code (Google Pay, PhonePe, Paytm)'],
                ['Card', 'Credit / Debit Card (Visa, Mastercard, RuPay)'],
                ['NetBanking', 'Net Banking (SBI, HDFC, ICICI, Axis)'],
                ['COD', 'Cash on Delivery / Meetup Payment']
              ].map(([key, label]) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid ' + (paymentMethod === key ? 'var(--forest)' : 'var(--line)'),
                    borderRadius: '8px',
                    background: paymentMethod === key ? '#eef5e9' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === key}
                    onChange={() => setPaymentMethod(key)}
                  />
                  <div>
                    <strong>{key}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{label}</small>
                  </div>
                </label>
              ))}
            </div>

            {error && <p className="error">{error}</p>}

            <button className="button" disabled={processing} style={{ width: '100%', marginTop: '14px' }}>
              {processing ? 'Processing Payment…' : `Pay ${money(item.price)} Now`}
            </button>
          </form>
        </section>

        {/* Item Summary Card */}
        <section className="panel">
          <h2>Order Summary</h2>
          <div className="product-art" style={{ height: '160px', marginBottom: '14px' }}>
            <img
              src={item.image_url || (item.category_name === 'Mobile Phones' ? DEFAULT_PHONE_IMAGE : null)}
              alt={item.title}
            />
          </div>
          <h3>{item.title}</h3>
          <p className="muted">{item.category_name} · {item.condition}</p>
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Item Price:</span>
            <strong>{money(item.price)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Platform Service Fee:</span>
            <strong style={{ color: 'var(--forest)' }}>FREE</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Delivery / Shipping:</span>
            <strong>Seller Direct</strong>
          </div>
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
            <span>Total Payable:</span>
            <strong>{money(item.price)}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}
