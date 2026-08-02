import React from 'react';

export function DynamicField({ f, value, change, error, onBlur }) {
  const set = (v) => {
    change(f.key, v);
    if (onBlur) onBlur(f.key, v);
  };
  const common = {
    value: value || '',
    onChange: (e) => set(e.target.value),
    onBlur: (e) => onBlur && onBlur(f.key, e.target.value),
    placeholder: f.placeholder || ''
  };

  return (
    <label className="field">
      <span>
        {f.label}
        {f.required && <b> *</b>}
      </span>
      {f.helpText && <em>{f.helpText}</em>}

      {f.type === 'select' ? (
        <select {...common}>
          <option value="">Select</option>
          {(f.options || []).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      ) : f.type === 'radio' ? (
        <div className="choices">
          {(f.options || []).map((x) => (
            <button
              type="button"
              key={x}
              className={value === x ? 'selected' : ''}
              onClick={() => set(x)}
            >
              {x}
            </button>
          ))}
        </div>
      ) : f.type === 'checkbox' ? (
        <div className="checks">
          {(f.options || []).map((x) => (
            <label key={x}>
              <input
                type="checkbox"
                checked={(value || []).includes(x)}
                onChange={(e) =>
                  set(
                    e.target.checked
                      ? [...(value || []), x]
                      : (value || []).filter((y) => y !== x)
                  )
                }
              />
              {x}
            </label>
          ))}
        </div>
      ) : f.type === 'textarea' ? (
        <textarea {...common} />
      ) : (
        <input
          type={f.type || 'text'}
          {...common}
          {...(f.type === 'date' && (f.key === 'purchase_date' || f.key.includes('purchase'))
            ? { max: new Date().toISOString().split('T')[0] }
            : {})}
        />
      )}

      {error && <i>{error}</i>}
    </label>
  );
}
