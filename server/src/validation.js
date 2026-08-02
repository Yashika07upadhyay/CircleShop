export const LISTING_LIMITS = {
  titleMin: 3,
  titleMax: 90,
  descriptionMin: 10,
  descriptionMax: 2000,
  locationMin: 2,
  locationMax: 80,
  priceMin: 1
};

export function validateListing(payload, fieldConfigs) {
  const errors = {};
  for (const name of ['title', 'description', 'price', 'condition', 'location']) {
    const val = payload[name];
    if (val === undefined || val === null || String(val) === '') {
      errors[name] = 'Required';
    } else if (String(val).trim() === '') {
      errors[name] = 'Empty spaces not allowed';
    }
  }

  const title = String(payload.title || '').trim();
  if (title && title.length < LISTING_LIMITS.titleMin) {
    errors.title = `Use at least ${LISTING_LIMITS.titleMin} characters`;
  } else if (title.length > LISTING_LIMITS.titleMax) {
    errors.title = `Use ${LISTING_LIMITS.titleMax} characters or fewer`;
  }

  const description = String(payload.description || '').trim();
  if (description && description.length < LISTING_LIMITS.descriptionMin) {
    errors.description = `Use at least ${LISTING_LIMITS.descriptionMin} characters`;
  } else if (description.length > LISTING_LIMITS.descriptionMax) {
    errors.description = `Use ${LISTING_LIMITS.descriptionMax} characters or fewer`;
  }

  const location = String(payload.location || '').trim();
  if (location && location.length < LISTING_LIMITS.locationMin) {
    errors.location = `Use at least ${LISTING_LIMITS.locationMin} characters`;
  } else if (location.length > LISTING_LIMITS.locationMax) {
    errors.location = `Use ${LISTING_LIMITS.locationMax} characters or fewer`;
  }

  if (payload.price !== undefined && payload.price !== null && payload.price !== '') {
    const priceNum = Number(payload.price);
    if (!Number.isFinite(priceNum) || priceNum < LISTING_LIMITS.priceMin) {
      errors.price = 'Enter a price greater than zero';
    }
  }

  if (payload.imageUrl) {
    const url = String(payload.imageUrl);
    if (!url.startsWith('data:image/')) {
      errors.imageUrl = 'Upload a JPG, PNG, or WebP image';
    } else if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(url)) {
      errors.imageUrl = 'Only JPG, PNG, or WebP images are supported';
    }
  }

  for (const config of fieldConfigs) {
    const value = payload.attributes?.[config.key];
    const rule = config.conditional;
    const visible = !rule || payload.attributes?.[rule.fieldKey] === rule.equals;
    if (!visible) continue;
    const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && !value.length);
    if (config.required && isEmpty) {
      if (typeof value === 'string' && value !== '' && value.trim() === '') {
        errors[config.key] = 'Empty spaces not allowed';
      } else {
        errors[config.key] = 'Required';
      }
    }
    const rules = config.rules || {};
    if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')) {
      if (config.type === 'number' && (!Number.isFinite(Number(value)) || (rules.min != null && Number(value) < rules.min) || (rules.max != null && Number(value) > rules.max))) {
        errors[config.key] = `Use a value between ${rules.min ?? '−∞'} and ${rules.max ?? '∞'}`;
      }
      if (typeof value === 'string' && ((rules.minLength && value.length < rules.minLength) || (rules.maxLength && value.length > rules.maxLength))) {
        errors[config.key] = `Use ${rules.minLength ?? 0}–${rules.maxLength ?? 'more'} characters`;
      }
      if (config.type === 'date') {
        const dateVal = new Date(value);
        if (isNaN(dateVal.getTime())) {
          errors[config.key] = 'Invalid date';
        } else if (config.key === 'purchase_date' || config.key.includes('purchase')) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          if (dateVal > today) {
            errors[config.key] = 'Purchase date cannot be in the future';
          }
        }
      }
    }
  }
  return errors;
}
