export function validateListing(payload, fieldConfigs) {
  const errors = {};
  for (const name of ['title', 'description', 'price', 'condition', 'location']) {
    if (payload[name] === undefined || payload[name] === null || payload[name] === '') errors[name] = 'Required';
  }
  if (payload.title?.length > 90) errors.title = 'Use 90 characters or fewer';
  if (payload.price !== undefined && (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)) errors.price = 'Enter a valid price';
  for (const config of fieldConfigs) {
    const value = payload.attributes?.[config.key];
    const rule = config.conditional;
    const visible = !rule || payload.attributes?.[rule.fieldKey] === rule.equals;
    if (!visible) continue;
    if (config.required && (value === undefined || value === '' || (Array.isArray(value) && !value.length))) errors[config.key] = 'Required';
    const rules = config.rules || {};
    if (value !== undefined && value !== '') {
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
