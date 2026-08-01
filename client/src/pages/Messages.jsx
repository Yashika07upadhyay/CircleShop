import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Messages() {
  const { user } = useAuth();
  const location = useLocation();
  const initialListing = location.state?.listing || null;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [activeListing, setActiveListing] = useState(initialListing);

  const fetchMessages = async () => {
    try {
      const data = await api('/messages');
      setMessages(data);
      if (!activeListing && data.length > 0) {
        setActiveListing({
          id: data[0].listing_id,
          title: data[0].listing_title,
          seller_id: data[0].sender_id === user.id ? data[0].receiver_id : data[0].sender_id,
          seller_name: data[0].sender_id === user.id ? data[0].receiver_name : data[0].sender_name
        });
      }
    } catch (err) {
      setError(err?.error || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeListing) return;
    setError('');

    const recipientId = activeListing.seller_id === user.id ? activeListing.buyer_id : activeListing.seller_id;

    try {
      await api('/messages', {
        method: 'POST',
        body: JSON.stringify({
          listingId: activeListing.id,
          receiverId: recipientId || activeListing.seller_id,
          message: text.trim()
        })
      });
      setText('');
      await fetchMessages();
    } catch (err) {
      setError(err?.error || 'Failed to send message');
    }
  };

  // Group messages by listing
  const conversationsMap = {};
  messages.forEach((m) => {
    if (!conversationsMap[m.listing_id]) {
      conversationsMap[m.listing_id] = {
        listingId: m.listing_id,
        listingTitle: m.listing_title,
        otherUser: m.sender_id === user?.id ? m.receiver_name : m.sender_name,
        otherUserId: m.sender_id === user?.id ? m.receiver_id : m.sender_id,
        messages: []
      };
    }
    conversationsMap[m.listing_id].messages.push(m);
  });

  const activeConv = activeListing ? conversationsMap[activeListing.id] : null;

  return (
    <main>
      <p className="eyebrow">Direct Communications</p>
      <h1>Marketplace Messages</h1>

      {loading ? (
        <p className="muted">Loading messages…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginTop: '24px' }}>
          {/* Conversation List */}
          <div className="panel">
            <h2>Conversations</h2>
            {Object.keys(conversationsMap).length === 0 ? (
              <p className="muted">No messages yet. Click "Message seller" on any listing to start a chat!</p>
            ) : (
              Object.values(conversationsMap).map((conv) => (
                <button
                  key={conv.listingId}
                  className={'category-row ' + (activeListing?.id === conv.listingId ? 'active' : '')}
                  onClick={() =>
                    setActiveListing({
                      id: conv.listingId,
                      title: conv.listingTitle,
                      seller_id: conv.otherUserId,
                      seller_name: conv.otherUser
                    })
                  }
                >
                  <span>💬</span>
                  <div>
                    <strong>{conv.listingTitle}</strong>
                    <small>With {conv.otherUser} · {conv.messages.length} messages</small>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Active Conversation Chat Window */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '540px' }}>
            {activeListing ? (
              <>
                <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '20px', margin: 0 }}>{activeListing.title}</h2>
                  <small className="muted">Chatting regarding listing #{activeListing.id}</small>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingRight: '6px'
                  }}
                >
                  {activeConv?.messages.map((m) => {
                    const isMe = m.sender_id === user.id;
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          background: isMe ? 'var(--forest)' : '#eef5e9',
                          color: isMe ? '#fff' : 'var(--ink)'
                        }}
                      >
                        <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
                          {isMe ? 'You' : m.sender_name}
                        </div>
                        <div>{m.message}</div>
                        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                  {(!activeConv || activeConv.messages.length === 0) && (
                    <p className="muted">Send your first message below to start the conversation!</p>
                  )}
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input
                    style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--line)' }}
                    placeholder="Type your message…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <button className="button" style={{ padding: '0 20px' }}>
                    Send
                  </button>
                </form>
                {error && <p className="error" style={{ fontSize: '12px', marginTop: '6px' }}>{error}</p>}
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)' }}>
                Select a conversation on the left or click "Message Seller" on a listing page.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
