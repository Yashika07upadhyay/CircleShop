import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'];

function readRulesFromForm(f) {
  const minVal = f.get('min');
  const maxVal = f.get('max');
  const minLen = f.get('minLength');
  const maxLen = f.get('maxLength');
  const defaultVal = f.get('defaultValue');

  const rules = {};
  if (minVal !== '' && minVal !== null) rules.min = Number(minVal);
  if (maxVal !== '' && maxVal !== null) rules.max = Number(maxVal);
  if (minLen !== '' && minLen !== null) rules.minLength = Number(minLen);
  if (maxLen !== '' && maxLen !== null) rules.maxLength = Number(maxLen);
  if (defaultVal !== '' && defaultVal !== null && defaultVal !== undefined) rules.default = defaultVal;
  return rules;
}

export function Admin() {
  const [catalog, setCatalog] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAdminUserModal, setShowAdminUserModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCreateAdminUser = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const name = (f.get('name') || '').trim();
    const email = (f.get('email') || '').trim();
    const password = (f.get('password') || '');
    if (!name) return showToast('Empty spaces not allowed.', 'error');
    if (!email) return showToast('Empty spaces not allowed.', 'error');
    if (!password.trim()) return showToast('Empty spaces not allowed.', 'error');
    try {
      const newUser = await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role: f.get('role') || 'admin'
        })
      });
      showToast(`Account "${newUser.email}" (${newUser.role}) created successfully!`, 'success');
      setShowAdminUserModal(false);
      if (formEl) formEl.reset();
    } catch (x) {
      showToast('Failed to create account: ' + (x?.error || x?.message || 'Error'), 'error');
    }
  };

  // NOTE: this no longer shows its own toast on failure. It's called by
  // every create/update/save handler AFTER that action already succeeded,
  // purely to refresh the on-screen catalog. It used to show an error toast
  // on any hiccup here, which silently overwrote the real success toast
  // from the action that just worked — that was the "it got created but
  // the toast says error" bug. A failed background refresh is now just
  // logged, not shown as if the create/update itself failed.
  const load = (targetCategoryId) => {
    return api('/admin/catalog')
      .then((x) => {
        setCatalog(x);
        setActiveCategory((currentActive) => {
          const matchId = targetCategoryId !== undefined && targetCategoryId !== null ? targetCategoryId : currentActive?.id;
          if (matchId === undefined || matchId === null) return x.categories[0] || null;
          return x.categories.find((c) => String(c.id) === String(matchId)) || x.categories[0] || null;
        });
        return x;
      })
      .catch((err) => {
        console.error('Failed to reload catalog:', err);
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (!catalog || !activeCategory) {
    return (
      <main className="admin">
        <p className="eyebrow">Platform Admin</p>
        <h1>Catalog Administration</h1>
        <p className="muted">Loading catalog data…</p>
      </main>
    );
  }

  const categoryFields = activeCategory.fields || [];

  const updateCategoryFieldsState = (newFields) => {
    setActiveCategory({ ...activeCategory, fields: newFields });
  };

  const saveSchema = async () => {
    try {
      await api('/admin/categories/' + activeCategory.id + '/fields', {
        method: 'PUT',
        body: JSON.stringify({
          fields: categoryFields.map((f) => ({
            fieldId: f.id,
            required: !!f.required,
            conditional: f.conditional || null
          }))
        })
      });
      showToast(`Category schema for "${activeCategory.name}" saved successfully!`, 'success');
      await load(activeCategory.id);
    } catch (x) {
      showToast('Failed to save schema: ' + (x?.error || x?.message || 'Unknown error'), 'error');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const name = (f.get('name') || '').trim();
    if (!name) return showToast('Empty spaces not allowed.', 'error');

    try {
      const newCat = await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          icon: (f.get('icon') || '').trim() || '◈',
          description: (f.get('description') || '').trim()
        })
      });
      setShowCategoryModal(false);
      if (formEl) formEl.reset();
      showToast(`Category "${newCat.name}" created and selected!`, 'success');
      await load(newCat.id);
    } catch (x) {
      showToast('Category creation failed: ' + (x?.error || x?.message || 'Error'), 'error');
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const name = (f.get('name') || '').trim();
    if (!name) return showToast('Empty spaces not allowed.', 'error');

    try {
      const updated = await api('/admin/categories/' + editingCategory.id, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          icon: (f.get('icon') || '').trim() || '◈',
          description: (f.get('description') || '').trim()
        })
      });
      setEditingCategory(null);
      showToast(`Category "${updated.name}" updated successfully!`, 'success');
      await load(updated.id);
    } catch (x) {
      showToast('Failed to update category: ' + (x?.error || x?.message || 'Error'), 'error');
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    try {
      await api('/admin/categories/' + cat.id, {
        method: 'PATCH',
        body: JSON.stringify({ active: !cat.active })
      });
      showToast(`"${cat.name}" is now ${!cat.active ? 'active' : 'inactive'}.`, 'info');
      await load(activeCategory.id);
    } catch (x) {
      showToast('Failed to update category: ' + (x?.error || x?.message || 'Error'), 'error');
    }
  };

  const handleCreateField = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const optionsRaw = f.get('options') || '';
    const label = (f.get('label') || '').trim();
    const rawKey = (f.get('key') || '').trim();
    if (!label) return showToast('Empty spaces not allowed.', 'error');
    if (!rawKey) return showToast('Empty spaces not allowed.', 'error');

    try {
      const createdField = await api('/admin/fields', {
        method: 'POST',
        body: JSON.stringify({
          label,
          key: rawKey,
          type: f.get('type'),
          placeholder: (f.get('placeholder') || '').trim(),
          helpText: (f.get('helpText') || '').trim(),
          options: optionsRaw.split(',').map((s) => s.trim()).filter(Boolean),
          rules: readRulesFromForm(f)
        })
      });
      if (formEl) formEl.reset();
      showToast(`Field "${createdField.label || label}" (${createdField.key}) created and added to library!`, 'success');
      await load(activeCategory.id);
    } catch (x) {
      showToast(x?.error || x?.message || 'Failed to create field', 'error');
    }
  };

  const handleUpdateField = async (e) => {
    e.preventDefault();
    if (!editingField) return;
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const optionsRaw = f.get('options') || '';
    const label = (f.get('label') || '').trim();
    const rawKey = (f.get('key') || '').trim();
    if (!label) return showToast('Empty spaces not allowed.', 'error');
    if (!rawKey) return showToast('Empty spaces not allowed.', 'error');

    try {
      const updated = await api('/admin/fields/' + editingField.id, {
        method: 'PATCH',
        body: JSON.stringify({
          label,
          key: rawKey,
          type: f.get('type'),
          placeholder: (f.get('placeholder') || '').trim(),
          helpText: (f.get('helpText') || '').trim(),
          options: optionsRaw.split(',').map((s) => s.trim()).filter(Boolean),
          rules: readRulesFromForm(f)
        })
      });
      setEditingField(null);
      showToast(`Field "${updated.label || label}" (${updated.key}) updated successfully.`, 'success');
      await load(activeCategory.id);
    } catch (x) {
      showToast(x?.error || x?.message || 'Failed to update field', 'error');
    }
  };

  const handleDeleteField = async (field) => {
    if (!window.confirm(`Delete the reusable field "${field.label}"? This can't be undone.`)) return;
    try {
      await api('/admin/fields/' + field.id, { method: 'DELETE' });
      showToast(`Field "${field.label}" deleted from library.`, 'info');
      await load(activeCategory.id);
    } catch (x) {
      showToast(x?.error || 'Failed to delete field', 'error');
    }
  };

  return (
    <main className="admin">
      <h1>Build schemas, not forms.</h1>

      <div className="admin-grid">
        {/* Panel 1: Categories list & Creation */}
        <section className="panel">
          <h2 style={{ marginBottom: '10px' }}>Categories</h2>
          <button
            className="button"
            style={{ width: '100%', marginBottom: '14px', fontSize: '13px', padding: '8px 12px' }}
            onClick={() => setShowCategoryModal(true)}
          >
            + New Category
          </button>
          {catalog.categories.map((x) => (
            <div key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
              <button
                className={'category-row ' + (activeCategory.id === x.id ? 'active' : '')}
                onClick={() => setActiveCategory(x)}
                style={{ width: '100%' }}
              >
                <span>{x.icon}</span>
                <div>
                  <strong>
                    {x.name} {!x.active && <small style={{ color: '#b02e2e' }}>(inactive)</small>}
                  </strong>
                  <small>{x.fields.length} schema fields</small>
                </div>
              </button>
              <div style={{ display: 'flex', gap: '6px', margin: '4px 0 10px' }}>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: '11px', padding: '5px 8px', background: '#f0f4ec', color: 'var(--forest)' }}
                  onClick={() => setEditingCategory(x)}
                >
                  ✎ Edit
                </button>
                <button
                  type="button"
                  style={{ flex: 1, fontSize: '11px', padding: '5px 8px', background: x.active ? '#fdecea' : '#eef5e9', color: x.active ? '#b02e2e' : 'var(--forest)' }}
                  onClick={() => handleToggleCategoryActive(x)}
                >
                  {x.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Panel 2: Active Category Schema Builder */}
        <section className="panel">
          <h2>{activeCategory.name} schema</h2>
          <p className="muted">
            Select fields for this category, set requirement rules, adjust display order, and configure conditional logic.
          </p>
          {!activeCategory.active && (
            <p className="error">
              This category is inactive — it's hidden from the homepage filter and sellers can't create new listings under it until you reactivate it.
            </p>
          )}

          <div className="field-list">
            {catalog.fields.map((f) => {
              const inUse = categoryFields.find((x) => x.id === f.id);
              const at = categoryFields.findIndex((x) => x.id === f.id);

              return (
                <div className={'catalog-field ' + (inUse ? 'included' : '')} key={f.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <label style={{ flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={!!inUse}
                        onChange={() => {
                          // Local UI state only — this does NOT save to the
                          // server. Nothing is persisted until "Save category
                          // schema" is clicked, and no toast fires here
                          // anymore, since seeing a toast made it look like a
                          // save had already happened when it hadn't.
                          if (inUse) {
                            updateCategoryFieldsState(categoryFields.filter((x) => x.id !== f.id));
                          } else {
                            updateCategoryFieldsState([...categoryFields, { ...f, required: false, conditional: null }]);
                          }
                        }}
                      />
                      <span>
                        <b>{f.label}</b> <small>{f.type} · key: <code>{f.key}</code>{f.rules?.default !== undefined && f.rules?.default !== '' ? <> · default: <code>{String(f.rules.default)}</code></> : null}</small>
                      </span>
                    </label>
                    <button
                      type="button"
                      title="Delete this field definition"
                      style={{ padding: '4px 8px', fontSize: '12px', background: '#fdecea', color: '#b02e2e' }}
                      onClick={() => handleDeleteField(f)}
                    >
                      🗑
                    </button>
                  </div>

                  {inUse && (
                    <div className="field-actions">
                      <label className="required">
                        <input
                          type="checkbox"
                          checked={!!inUse.required}
                          onChange={(e) =>
                            updateCategoryFieldsState(
                              categoryFields.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x))
                            )
                          }
                        />{' '}
                        Required
                      </label>
                      <button
                        disabled={at === 0}
                        onClick={() =>
                          updateCategoryFieldsState(
                            categoryFields.map((x, i) => (i === at ? categoryFields[at - 1] : i === at - 1 ? categoryFields[at] : x))
                          )
                        }
                      >
                        ↑
                      </button>
                      <button
                        disabled={at === categoryFields.length - 1}
                        onClick={() =>
                          updateCategoryFieldsState(
                            categoryFields.map((x, i) => (i === at ? categoryFields[at + 1] : i === at + 1 ? categoryFields[at] : x))
                          )
                        }
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setEditingField(f)}
                        style={{ background: '#f0f4ec', color: 'var(--forest)' }}
                      >
                        ✎ Edit Field
                      </button>
                    </div>
                  )}

                  {/* Conditional Logic Configuration */}
                  {inUse && (
                    <div className="conditional-config">
                      <span>Condition: Show only if</span>
                      <select
                        value={inUse.conditional?.fieldKey || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            updateCategoryFieldsState(
                              categoryFields.map((x) => (x.id === f.id ? { ...x, conditional: null } : x))
                            );
                          } else {
                            updateCategoryFieldsState(
                              categoryFields.map((x) =>
                                x.id === f.id
                                  ? { ...x, conditional: { fieldKey: val, equals: inUse.conditional?.equals || '' } }
                                  : x
                              )
                            );
                          }
                        }}
                      >
                        <option value="">None (Always visible)</option>
                        {categoryFields
                          .filter((cf) => cf.id !== f.id)
                          .map((cf) => (
                            <option key={cf.key} value={cf.key}>
                              {cf.label} ({cf.key})
                            </option>
                          ))}
                      </select>

                      {inUse.conditional?.fieldKey && (
                        <>
                          <span>equals</span>
                          <input
                            type="text"
                            placeholder="e.g. Yes"
                            value={inUse.conditional?.equals || ''}
                            onChange={(e) => {
                              const eqVal = e.target.value;
                              updateCategoryFieldsState(
                                categoryFields.map((x) =>
                                  x.id === f.id
                                    ? { ...x, conditional: { ...x.conditional, equals: eqVal } }
                                    : x
                                )
                              );
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="button" onClick={saveSchema}>
            Save category schema
          </button>
        </section>

        {/* Panel 3: Create Reusable Field with Validation & Config */}
        <section className="panel">
          <h2>Create reusable field</h2>
          <p className="muted">Define fields with custom validation rules, default values, placeholders, and help text.</p>
          <form className="compact" onSubmit={handleCreateField}>
            <input
              name="label"
              required
              pattern=".*\S.*"
              title="Empty spaces not allowed"
              placeholder="Field label (e.g. Warranty Period)"
            />
            <input
              name="key"
              required
              pattern=".*\S.*"
              title="Empty spaces not allowed"
              placeholder="Stable key (e.g. warranty_period)"
            />
            <select name="type">
              {FIELD_TYPES.map((x) => (
                <option key={x} value={x}>
                  Type: {x}
                </option>
              ))}
            </select>
            <input name="options" placeholder="Options, comma separated (for select/radio)" />
            <input name="placeholder" placeholder="Placeholder text" />
            <input name="helpText" placeholder="Help text / instruction hint" />
            <input name="defaultValue" placeholder="Default value (for select/radio: must match an option exactly; checkbox: comma-separated)" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <input type="number" name="min" placeholder="Min value (number)" />
              <input type="number" name="max" placeholder="Max value (number)" />
              <input type="number" name="minLength" placeholder="Min length (text)" />
              <input type="number" name="maxLength" placeholder="Max length (text)" />
            </div>

            <button>+ Create Field</button>
          </form>
        </section>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Category Creation Modal */}
      {showCategoryModal && (
        <div className="modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Category</h2>
              <button className="close-btn" onClick={() => setShowCategoryModal(false)}>
                ✕
              </button>
            </div>
            <form className="compact" onSubmit={handleCreateCategory}>
              <label className="field">
                <span>Category Name *</span>
                <input
                  name="name"
                  required
                  pattern=".*\S.*"
                  title="Category name cannot be empty or only spaces"
                  placeholder="e.g. Furniture, Books, Gaming"
                />
              </label>
              <label className="field">
                <span>Icon</span>
                <input name="icon" placeholder="Emoji or symbol (e.g. 🛋 📚 🎮)" defaultValue="◈" />
                <small style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Paste any emoji or symbol. Leave blank to use default ◈
                </small>
              </label>
              <label className="field">
                <span>Description</span>
                <textarea name="description" placeholder="Short description for this category" />
              </label>
              <button className="button" style={{ marginTop: '10px' }}>
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Edit Modal */}
      {editingCategory && (
        <div className="modal-backdrop" onClick={() => setEditingCategory(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Category: {editingCategory.name}</h2>
              <button className="close-btn" onClick={() => setEditingCategory(null)}>
                ✕
              </button>
            </div>
            <form className="compact" onSubmit={handleUpdateCategory}>
              <label className="field">
                <span>Category Name</span>
                <input
                  name="name"
                  required
                  pattern=".*\S.*"
                  title="Category name cannot be empty or only spaces"
                  defaultValue={editingCategory.name}
                />
              </label>
              <label className="field">
                <span>Icon</span>
                <input name="icon" defaultValue={editingCategory.icon || '◈'} />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea name="description" defaultValue={editingCategory.description || ''} />
              </label>
              <button className="button" style={{ marginTop: '10px' }}>
                Save Category Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Field Edit Modal */}
      {editingField && (
        <div className="modal-backdrop" onClick={() => setEditingField(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Field: {editingField.key}</h2>
              <button className="close-btn" onClick={() => setEditingField(null)}>
                ✕
              </button>
            </div>
            <form className="compact" onSubmit={handleUpdateField}>
              <label className="field">
                <span>Field Label</span>
                <input
                  name="label"
                  required
                  pattern=".*\S.*"
                  title="Empty spaces not allowed"
                  defaultValue={editingField.label}
                />
              </label>
              <label className="field">
                <span>Stable Key</span>
                <input
                  name="key"
                  required
                  pattern=".*\S.*"
                  title="Empty spaces not allowed"
                  defaultValue={editingField.key}
                />
              </label>
              <label className="field">
                <span>Field Type</span>
                <select name="type" defaultValue={editingField.type}>
                  {FIELD_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Options (comma-separated)</span>
                <input name="options" defaultValue={(editingField.options || []).join(', ')} />
              </label>
              <label className="field">
                <span>Placeholder</span>
                <input name="placeholder" defaultValue={editingField.placeholder || ''} />
              </label>
              <label className="field">
                <span>Help Text</span>
                <input name="helpText" defaultValue={editingField.helpText || ''} />
              </label>
              <label className="field">
                <span>Default Value</span>
                <input name="defaultValue" defaultValue={editingField.rules?.default ?? ''} placeholder="For select/radio: must match an option exactly; checkbox: comma-separated" />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label className="field">
                  <span>Min Number Value</span>
                  <input type="number" name="min" defaultValue={editingField.rules?.min ?? ''} />
                </label>
                <label className="field">
                  <span>Max Number Value</span>
                  <input type="number" name="max" defaultValue={editingField.rules?.max ?? ''} />
                </label>
                <label className="field">
                  <span>Min Text Length</span>
                  <input type="number" name="minLength" defaultValue={editingField.rules?.minLength ?? ''} />
                </label>
                <label className="field">
                  <span>Max Text Length</span>
                  <input type="number" name="maxLength" defaultValue={editingField.rules?.maxLength ?? ''} />
                </label>
              </div>

              <button className="button" style={{ marginTop: '14px' }}>
                Save Field Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {showAdminUserModal && (
        <div className="modal-backdrop" onClick={() => setShowAdminUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Create New Admin Account</h2>
              <button className="close-btn" onClick={() => setShowAdminUserModal(false)}>
                ✕
              </button>
            </div>
            <form className="compact" onSubmit={handleCreateAdminUser}>
              <label className="field">
                <span>Full Name</span>
                <input
                  name="name"
                  required
                  pattern=".*\S.*"
                  title="Empty spaces not allowed"
                  placeholder="e.g. Admin User"
                />
              </label>
              <label className="field">
                <span>Email Address</span>
                <input
                  name="email"
                  type="email"
                  required
                  pattern=".*\S.*"
                  title="Empty spaces not allowed"
                  placeholder="admin@example.com"
                />
              </label>
              <label className="field">
                <span>Password (6+ chars)</span>
                <input
                  name="password"
                  type="password"
                  minLength={6}
                  required
                  pattern=".*\S.*"
                  title="Empty spaces not allowed"
                  placeholder="Password"
                />
              </label>
              <label className="field">
                <span>Account Role</span>
                <select name="role" defaultValue="admin">
                  <option value="admin">Platform Admin</option>
                  <option value="user">Standard User</option>
                </select>
              </label>
              <button className="button" style={{ marginTop: '14px' }}>
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
