export function formatMessage(message, translate = key => key) {
  const { key, params = {} } = message;
  return translate(key).replace(/\{(\w+)\}/g, (placeholder, name) => {
    if (!Object.hasOwn(params, name)) return placeholder;
    const value = params[name];
    return value && typeof value === 'object' && typeof value.key === 'string'
      ? formatMessage(value, translate)
      : String(value);
  });
}

export function notice(key, params = {}) {
  const message = { key, params };
  return { text: formatMessage(message), message };
}

export function failure(key, params = {}) {
  const { text, message } = notice(key, params);
  return { ok: false, reason: text, message };
}

export function localizedError(key, params = {}) {
  const { text, message } = notice(key, params);
  return Object.assign(new Error(text), { localized: message });
}
