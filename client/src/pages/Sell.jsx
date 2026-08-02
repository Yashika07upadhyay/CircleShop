import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DynamicField } from '../components/DynamicField';

export function Sell() {
  const navigate = useNavigate();

  const [cats, setCats] = useState([]);
  const [id, setId] = useState('');
  const [schema, setSchema] = useState([]);
  const [form, setForm] = useState(() =>
    JSON.parse(sessionStorage.getItem('draft') || '{"condition":"Good","attributes":{}}')
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api('/categories').then(setCats).catch(console.error);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('draft', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (id) {
      // Clear dynamic category field errors when category changes
      setErrors((prev) => {
        const next = {};
        for (const name of ['title', 'description', 'price', 'condition', 'location']) {
          if (prev[name]) next[name] = prev[name];
        }
        return next;
      });
      api('/categories/' + id + '/schema')
        .then((s) => {
          setSchema(s);
          // Pre-fill any admin-configured default values for fields the
          // seller hasn't already touched. Never overwrites an existing
          // draft value — defaults only fill genuinely empty fields.
          setForm((prev) => {
            const attributes = { ...prev.attributes };
            let changed = false;
            s.forEach((f) => {
              const def = f.rules?.default;
              if (def === undefined || def === '' || attributes[f.key] !== undefined) return;
              attributes[f.key] = f.type === 'checkbox'
                ? String(def).split(',').map((x) => x.trim()).filter(Boolean)
                : def;
              changed = true;
            });
            return changed ? { ...prev, attributes } : prev;
          });
        })
        .catch(console.error);
    }
  }, [id]);

  const update = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  const upload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 4e6) {
      return setErrors((x) => ({ ...x, imageUrl: 'Choose an image below 4 MB' }));
    }
    const r = new FileReader();
    r.onload = () => update('imageUrl', r.result);
    r.readAsDataURL(f);
  };

  const validateField = (name, val) => {
    let err = '';
    const stringVal = String(val || '');
    if (name === 'title' || name === 'description' || name === 'location') {
      if (!stringVal) {
        err = 'Required';
      } else if (!stringVal.trim()) {
        err = 'Empty spaces not allowed';
      }
    } else if (name === 'price') {
      if (val === undefined || val === null || val === '') {
        err = 'Required';
      } else if (!Number.isFinite(Number(val)) || Number(val) < 0) {
        err = 'Enter a valid price';
      }
    }
    setErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[name] = err;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const validateDynamicField = (key, val, config) => {
    let err = '';
    const isEmpty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && !val.length);
    if (config.required && isEmpty) {
      if (typeof val === 'string' && val !== '' && val.trim() === '') {
        err = 'Empty spaces not allowed';
      } else {
        err = 'Required';
      }
    }
    const rules = config.rules || {};
    if (val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === '')) {
      if (config.type === 'number' && (!Number.isFinite(Number(val)) || (rules.min != null && Number(val) < rules.min) || (rules.max != null && Number(val) > rules.max))) {
        err = `Use a value between ${rules.min ?? '−∞'} and ${rules.max ?? '∞'}`;
      }
      if (typeof val === 'string' && ((rules.minLength && val.length < rules.minLength) || (rules.maxLength && val.length > rules.maxLength))) {
        err = `Use ${rules.minLength ?? 0}–${rules.maxLength ?? 'more'} characters`;
      }
    }
    setErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[key] = err;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const isFormInvalid = () => {
    if (!id) return true;
    if (!String(form.title || '').trim()) return true;
    if (!String(form.description || '').trim()) return true;
    if (!String(form.location || '').trim()) return true;
    if (form.price === undefined || form.price === null || form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) return true;

    // Check visible dynamic fields
    const visibleSchema = schema.filter(
      (f) =>
        !f.conditional ||
        form.attributes?.[f.conditional.fieldKey] === f.conditional.equals
    );
    for (const f of visibleSchema) {
      const val = form.attributes?.[f.key];
      const isEmpty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && !val.length);
      if (f.required && isEmpty) return true;

      const rules = f.rules || {};
      if (val !== undefined && val !== null && !(typeof val === 'string' && val.trim() === '')) {
        if (f.type === 'number' && (!Number.isFinite(Number(val)) || (rules.min != null && Number(val) < rules.min) || (rules.max != null && Number(val) > rules.max))) return true;
        if (typeof val === 'string' && ((rules.minLength && val.length < rules.minLength) || (rules.maxLength && val.length > rules.maxLength))) return true;
      }
    }

    const errorKeys = Object.keys(errors).filter(k => k !== 'form' && k !== 'imageUrl');
    if (errorKeys.length > 0) return true;

    return false;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Final sanity check before submission
    if (isFormInvalid()) return;

    try {
      const d = await api('/listings', {
        method: 'POST',
        body: JSON.stringify({ ...form, categoryId: Number(id) })
      });
      sessionStorage.removeItem('draft');
      navigate('/listing/' + d.id, { replace: true, state: { from: '/' } });
    } catch (x) {
      setErrors(x.errors || { form: x.error || 'Failed to publish listing. Make sure you are logged in and try again.' });
    }
  };

  return (
    <main className="narrow">
      <p className="eyebrow">Create a listing</p>
      <h1>Tell us about your item</h1>
      <p className="muted">Your draft is automatically saved as you type.</p>

      <form onSubmit={submit}>
        <section className="form-section">
          <h2>Choose a category</h2>
          <div className="category-options">
            {cats.map((c) => (
              <button
                type="button"
                className={String(c.id) === id ? 'selected' : ''}
                onClick={() => setId(String(c.id))}
                key={c.id}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
        </section>

        {id && (
          <>
            <section className="form-section">
              <h2>Photos and essentials</h2>
              <div className="image-upload">
                <label className="upload-box">
                  <input type="file" accept="image/*" onChange={upload} />
                  <span>{form.imageUrl ? 'Change photo' : 'Upload a photo'}</span>
                  <small>JPG, PNG or WebP · max 4 MB</small>
                </label>
                {form.imageUrl && <img src={form.imageUrl} alt="Preview" />}
              </div>
              {errors.imageUrl && <p className="error">{errors.imageUrl}</p>}

              <div className="form-grid">
                {[
                  ['title', 'Title'],
                  ['price', 'Price (₹)'],
                  ['location', 'Location']
                ].map(([k, l]) => (
                  <label className="field" key={k}>
                    <span>{l} *</span>
                    <input
                      type={k === 'price' ? 'number' : 'text'}
                      value={form[k] || ''}
                      onChange={(e) => {
                        update(k, e.target.value);
                        validateField(k, e.target.value);
                      }}
                      onBlur={(e) => validateField(k, e.target.value)}
                    />
                    {errors[k] && <i>{errors[k]}</i>}
                  </label>
                ))}
                <label className="field">
                  <span>Condition *</span>
                  <select
                    value={form.condition || 'Good'}
                    onChange={(e) => update('condition', e.target.value)}
                  >
                    {['Like new', 'Excellent', 'Good', 'Fair'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  <span>Description *</span>
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => {
                      update('description', e.target.value);
                      validateField('description', e.target.value);
                    }}
                    onBlur={(e) => validateField('description', e.target.value)}
                  />
                  {errors.description && <i>{errors.description}</i>}
                </label>
              </div>
            </section>

            <section className="form-section">
              <h2>Category details</h2>
              <div className="form-grid">
                {schema
                  .filter(
                    (f) =>
                      !f.conditional ||
                      form.attributes?.[f.conditional.fieldKey] === f.conditional.equals
                  )
                  .map((f) => (
                    <DynamicField
                      key={f.key}
                      f={f}
                      value={form.attributes?.[f.key]}
                      change={(k, v) => {
                        setForm((x) => ({
                          ...x,
                          attributes: { ...x.attributes, [k]: v }
                        }));
                        validateDynamicField(f.key, v, f);
                      }}
                      onBlur={(k, v) => validateDynamicField(k, v, f)}
                      error={errors[f.key]}
                    />
                  ))}
              </div>
            </section>

            <div className="submit">
              <button className="button" disabled={isFormInvalid()}>Publish listing</button>
            </div>
            {errors.form && <p className="error" style={{ marginTop: '12px' }}>{errors.form}</p>}
          </>
        )}
      </form>
    </main>
  );
}
