import React from 'react';

export function Picture({ src, icon, large }) {
  return (
    <div className={'product-art ' + (large ? 'large' : '')}>
      {src ? <img src={src} alt="Listing" /> : <span>{icon || '📦'}</span>}
    </div>
  );
}
