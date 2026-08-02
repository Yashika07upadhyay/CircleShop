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

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation — catch whitespace-only and missing fields
    // before hitting the server so the user sees inline errors immediately.
    const clientErrors = {};
    if (!id) clientErrors.form = 'Please select a category before publishing.';

    const titleVal = String(form.title || '');
    if (!titleVal) {
      clientErrors.title = 'Required';
    } else if (!titleVal.trim()) {
      clientErrors.title = 'Empty spaces not allowed';
    }

    const descVal = String(form.description || '');
    if (!descVal) {
      clientErrors.description = 'Required';
    } else if (!descVal.trim()) {
      clientErrors.description = 'Empty spaces not allowed';
    }

    const locVal = String(form.location || '');
    if (!locVal) {
      clientErrors.location = 'Required';
    } else if (!locVal.trim()) {
      clientErrors.location = 'Empty spaces not allowed';
    }

    if (form.price === undefined || form.price === null || form.price === '') {
      clientErrors.price = 'Required';
    } else if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      clientErrors.price = 'Enter a valid price';
    }

    if (Object.keys(clientErrors).length) {
      return setErrors(clientErrors);
    }

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
                      onChange={(e) => update(k, e.target.value)}
                      required
                      {...(k !== 'price' ? { pattern: ".*\\S.*", title: "Empty spaces not allowed" } : { min: "0" })}
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
                    onChange={(e) => update('description', e.target.value)}
                    required
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
                      change={(k, v) =>
                        setForm((x) => ({
                          ...x,
                          attributes: { ...x.attributes, [k]: v }
                        }))
                      }
                      error={errors[f.key]}
                    />
                  ))}
              </div>
            </section>

            <div className="submit">
              <button className="button">Publish listing</button>
            </div>
            {errors.form && <p className="error" style={{ marginTop: '12px' }}>{errors.form}</p>}
          </>
        )}
      </form>
    </main>
  );
}
