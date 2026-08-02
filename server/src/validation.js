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
  if (payload.title && String(payload.title).trim().length > 90) errors.title = 'Use 90 characters or fewer';
  if (payload.price !== undefined && (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)) errors.price = 'Enter a valid price';
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
      if (config.type === 'number' && (!Number.isFinite(Number(value)) || (rules.min != null && Number(value) < rules.min) || (rules.max != null && Number(value) > rules.max))) errors[config.key] = `Use a value between ${rules.min ?? '−∞'} and ${rules.max ?? '∞'}`;
      if (typeof value === 'string' && ((rules.minLength && value.length < rules.minLength) || (rules.maxLength && value.length > rules.maxLength))) errors[config.key] = `Use ${rules.minLength ?? 0}–${rules.maxLength ?? 'more'} characters`;
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
