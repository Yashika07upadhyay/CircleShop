import React, { useEffect, useRef, useState } from 'react';
import { useApiBusy } from '../hooks/useApiBusy';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DynamicField } from '../components/DynamicField';
import { useAuth } from '../context/AuthContext';
import {
  EMPTY_LISTING_FORM,
  LISTING_LIMITS,
  collectListingErrors,
  draftKeyForUser,
  loadDraft,
  saveDraft,
  validateCoreField,
  validateDynamicValue,
  visibleSchemaFields
} from '../lib/listingValidation';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function Sell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [cats, setCats] = useState([]);
  const [id, setId] = useState('');
  const [schema, setSchema] = useState([]);
  const [form, setForm] = useState(() => loadDraft(user?.id));
  const [errors, setErrors] = useState({});
  const { busy: submitting, run: runSubmit } = useApiBusy();

  const prevUserIdRef = useRef(user?.id);
  const prevIdRef = useRef(id);

  useEffect(() => {
    api('/categories').then(setCats).catch(console.error);
  }, []);

  // Reload a clean draft when a different account logs in on this page.
  useEffect(() => {
    if (prevUserIdRef.current === user?.id) return;
    prevUserIdRef.current = user?.id;
    prevIdRef.current = '';
    setId('');
    setSchema([]);
    setForm(loadDraft(user?.id));
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [user?.id]);

  useEffect(() => {
    saveDraft(user?.id, form);
  }, [form, user?.id]);

  useEffect(() => {
    if (!id) return;

    const isSwitching = prevIdRef.current && prevIdRef.current !== id;
    prevIdRef.current = id;

    if (isSwitching) {
      setForm({ ...EMPTY_LISTING_FORM });
      setErrors({});
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    api('/categories/' + id + '/schema')
      .then((s) => {
        setSchema(s);
        setForm((prev) => {
          const base = isSwitching ? { ...EMPTY_LISTING_FORM } : prev;
          const attributes = isSwitching ? {} : { ...base.attributes };
          s.forEach((f) => {
            const def = f.rules?.default;
            if (def === undefined || def === '' || attributes[f.key] !== undefined) return;
            attributes[f.key] = f.type === 'checkbox'
              ? String(def).split(',').map((x) => x.trim()).filter(Boolean)
              : def;
          });
          return { ...base, attributes };
        });
      })
      .catch(console.error);
  }, [id]);

  const update = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  const setFieldError = (name, err) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[name] = err;
      else delete next[name];
      return next;
    });
  };

  const validateField = (name, val) => {
    setFieldError(name, validateCoreField(name, val));
  };

  const validateDynamicField = (key, val, config) => {
    setFieldError(key, validateDynamicValue(val, config));
  };

  const isFormInvalid = () => Object.keys(collectListingErrors(form, schema, id)).length > 0;

  const upload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) {
      setFieldError('imageUrl', 'Only JPG, PNG, or WebP images are supported');
      return;
    }
    if (f.size > 4e6) {
      setFieldError('imageUrl', 'Choose an image below 4 MB');
      return;
    }

    setFieldError('imageUrl', '');
    const r = new FileReader();
    r.onload = () => update('imageUrl', r.result);
    r.onerror = () => setFieldError('imageUrl', 'Could not read this image. Try another file.');
    r.readAsDataURL(f);
  };

  const removePhoto = () => {
    update('imageUrl', undefined);
    setFieldError('imageUrl', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = collectListingErrors(form, schema, id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await runSubmit(async () => {
      try {
        const d = await api('/listings', {
          method: 'POST',
          body: JSON.stringify({ ...form, categoryId: Number(id) })
        });
        sessionStorage.removeItem(draftKeyForUser(user?.id));
        setForm({ ...EMPTY_LISTING_FORM });
        setId('');
        setSchema([]);
        setErrors({});
        if (fileInputRef.current) fileInputRef.current.value = '';
        navigate('/listing/' + d.id, { replace: true, state: { from: '/' } });
      } catch (x) {
        setErrors(x.errors || { form: x.error || 'Failed to publish listing. Make sure you are logged in and try again.' });
      }
    });
  };

  const visibleFields = visibleSchemaFields(schema, form.attributes);

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
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
                  <span>{form.imageUrl ? 'Change photo' : 'Upload a photo'}</span>
                  <small>JPG, PNG or WebP · max 4 MB</small>
                </label>
                {form.imageUrl && (
                  <div className="photo-preview">
                    <img src={form.imageUrl} alt="Preview" />
                    <button type="button" className="photo-remove" aria-label="Remove photo" onClick={removePhoto}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {errors.imageUrl && <p className="error">{errors.imageUrl}</p>}

              <div className="form-grid">
                <label className="field">
                  <span>Title *</span>
                  <input
                    type="text"
                    value={form.title || ''}
                    maxLength={LISTING_LIMITS.titleMax}
                    onChange={(e) => {
                      update('title', e.target.value);
                      validateField('title', e.target.value);
                    }}
                    onBlur={(e) => validateField('title', e.target.value)}
                  />
                  {errors.title && <i>{errors.title}</i>}
                </label>
                <label className="field">
                  <span>Price (₹) *</span>
                  <input
                    type="number"
                    min={LISTING_LIMITS.priceMin}
                    step="1"
                    value={form.price ?? ''}
                    onChange={(e) => {
                      update('price', e.target.value);
                      validateField('price', e.target.value);
                    }}
                    onBlur={(e) => validateField('price', e.target.value)}
                  />
                  {errors.price && <i>{errors.price}</i>}
                </label>
                <label className="field">
                  <span>Location *</span>
                  <input
                    type="text"
                    value={form.location || ''}
                    maxLength={LISTING_LIMITS.locationMax}
                    onChange={(e) => {
                      update('location', e.target.value);
                      validateField('location', e.target.value);
                    }}
                    onBlur={(e) => validateField('location', e.target.value)}
                  />
                  {errors.location && <i>{errors.location}</i>}
                </label>
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
                    maxLength={LISTING_LIMITS.descriptionMax}
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

            {visibleFields.length > 0 && (
              <section className="form-section">
                <h2>Category details</h2>
                <div className="form-grid">
                  {visibleFields.map((f) => (
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
            )}

            <div className="submit">
              <button
                type="submit"
                className={'button' + (submitting ? ' busy' : '')}
                disabled={isFormInvalid() || submitting}
              >
                {submitting ? 'Publishing…' : 'Publish listing'}
              </button>
            </div>
            {errors.form && <p className="error" style={{ marginTop: '12px' }}>{errors.form}</p>}
          </>
        )}
      </form>
    </main>
  );
}
