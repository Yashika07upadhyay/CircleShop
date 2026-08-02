export const LISTING_LIMITS = {
  titleMin: 3,
  titleMax: 90,
  descriptionMin: 10,
  descriptionMax: 2000,
  locationMin: 2,
  locationMax: 80,
  priceMin: 1
};

export const EMPTY_LISTING_FORM = { condition: 'Good', attributes: {} };

export function draftKeyForUser(userId) {
  return userId ? `draft-${userId}` : 'draft-guest';
}

export function loadDraft(userId) {
  try {
    const raw = sessionStorage.getItem(draftKeyForUser(userId));
    return raw ? JSON.parse(raw) : { ...EMPTY_LISTING_FORM };
  } catch {
    return { ...EMPTY_LISTING_FORM };
  }
}

export function saveDraft(userId, form) {
  sessionStorage.setItem(draftKeyForUser(userId), JSON.stringify(form));
}

export function clearAllDrafts() {
  sessionStorage.removeItem('draft');
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith('draft-'))
    .forEach((k) => sessionStorage.removeItem(k));
}

export function validateCoreField(name, val) {
  const stringVal = String(val ?? '');
  const trimmed = stringVal.trim();

  if (name === 'title') {
    if (!trimmed) return trimmed !== stringVal ? 'Empty spaces not allowed' : 'Required';
    if (trimmed.length < LISTING_LIMITS.titleMin) return `Use at least ${LISTING_LIMITS.titleMin} characters`;
    if (trimmed.length > LISTING_LIMITS.titleMax) return `Use ${LISTING_LIMITS.titleMax} characters or fewer`;
    return '';
  }

  if (name === 'description') {
    if (!trimmed) return trimmed !== stringVal ? 'Empty spaces not allowed' : 'Required';
    if (trimmed.length < LISTING_LIMITS.descriptionMin) return `Use at least ${LISTING_LIMITS.descriptionMin} characters`;
    if (trimmed.length > LISTING_LIMITS.descriptionMax) return `Use ${LISTING_LIMITS.descriptionMax} characters or fewer`;
    return '';
  }

  if (name === 'location') {
    if (!trimmed) return trimmed !== stringVal ? 'Empty spaces not allowed' : 'Required';
    if (trimmed.length < LISTING_LIMITS.locationMin) return `Use at least ${LISTING_LIMITS.locationMin} characters`;
    if (trimmed.length > LISTING_LIMITS.locationMax) return `Use ${LISTING_LIMITS.locationMax} characters or fewer`;
    return '';
  }

  if (name === 'price') {
    if (val === undefined || val === null || val === '') return 'Required';
    const num = Number(val);
    if (!Number.isFinite(num) || num < LISTING_LIMITS.priceMin) return 'Enter a price greater than zero';
    return '';
  }

  return '';
}

export function validateDynamicValue(val, config) {
  const isEmpty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && !val.length);
  if (config.required && isEmpty) {
    if (typeof val === 'string' && val !== '' && val.trim() === '') return 'Empty spaces not allowed';
    return 'Required';
  }

  const rules = config.rules || {};
  if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) return '';

  if (config.type === 'number') {
    const num = Number(val);
    if (!Number.isFinite(num) || (rules.min != null && num < rules.min) || (rules.max != null && num > rules.max)) {
      return `Use a value between ${rules.min ?? '−∞'} and ${rules.max ?? '∞'}`;
    }
  }

  if (typeof val === 'string') {
    if (rules.minLength && val.length < rules.minLength) {
      return `Use ${rules.minLength}–${rules.maxLength ?? 'more'} characters`;
    }
    if (rules.maxLength && val.length > rules.maxLength) {
      return `Use ${rules.minLength ?? 0}–${rules.maxLength} characters`;
    }
  }

  if (config.type === 'date' && val) {
    const dateVal = new Date(val);
    if (isNaN(dateVal.getTime())) return 'Invalid date';
    if (config.key === 'purchase_date' || config.key.includes('purchase')) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dateVal > today) return 'Purchase date cannot be in the future';
    }
  }

  return '';
}

export function visibleSchemaFields(schema, attributes) {
  return schema.filter(
    (f) => !f.conditional || attributes?.[f.conditional.fieldKey] === f.conditional.equals
  );
}

export function collectListingErrors(form, schema, categoryId) {
  const errors = {};
  if (!categoryId) errors.form = 'Choose a category';

  for (const name of ['title', 'description', 'price', 'location']) {
    const err = validateCoreField(name, form[name]);
    if (err) errors[name] = err;
  }

  for (const f of visibleSchemaFields(schema, form.attributes)) {
    const err = validateDynamicValue(form.attributes?.[f.key], f);
    if (err) errors[f.key] = err;
  }

  return errors;
}
