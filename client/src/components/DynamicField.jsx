import React from 'react';

export function DynamicField({ f, value, change, error, onBlur }) {
  const rules = f.rules || {};

  const set = (v) => change(f.key, v);

  const handleChange = (e) => {
    set(e.target.value);
    if (onBlur) onBlur(f.key, e.target.value);
  };

  const handleBlur = (e) => {
    if (onBlur) onBlur(f.key, e.target.value);
  };

  const common = {
    value: value || '',
    onChange: handleChange,
    onBlur: handleBlur,
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
              onClick={() => {
                set(x);
                if (onBlur) onBlur(f.key, x);
              }}
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
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...(value || []), x]
                    : (value || []).filter((y) => y !== x);
                  set(next);
                  if (onBlur) onBlur(f.key, next);
                }}
              />
              {x}
            </label>
          ))}
        </div>
      ) : f.type === 'textarea' ? (
        <textarea
          {...common}
          {...(rules.maxLength ? { maxLength: rules.maxLength } : {})}
        />
      ) : (
        <input
          type={f.type || 'text'}
          {...common}
          {...(f.type === 'number'
            ? {
                ...(rules.min != null ? { min: rules.min } : {}),
                ...(rules.max != null ? { max: rules.max } : {})
              }
            : {
                ...(rules.minLength ? { minLength: rules.minLength } : {}),
                ...(rules.maxLength ? { maxLength: rules.maxLength } : {})
              })}
          {...(f.type === 'date' &&
          (f.key === 'purchase_date' || f.key.includes('purchase'))
            ? { max: new Date().toISOString().split('T')[0] }
            : {})}
        />
      )}

      {error && <i>{error}</i>}
    </label>
  );
}
