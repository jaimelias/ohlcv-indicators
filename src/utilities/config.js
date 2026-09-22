export const CONFIG_VERSION = 1;

// Copy configuration without JSON's silent conversion of functions/NaN to null.
export const copyConfig = (value, ancestors = new Set()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Configuration values must be JSON-safe: no undefined, non-finite numbers, or functions.');
  }
  if (ancestors.has(value)) throw new TypeError('Configuration must not contain circular references.');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Configuration must contain only plain objects and arrays.');
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Configuration must not contain symbol keys.');

  ancestors.add(value);
  const result = Array.isArray(value)
    ? Array.from(value, item => copyConfig(item, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyConfig(item, ancestors)]));
  ancestors.delete(value);
  return result;
};

export const freezeConfig = value => {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freezeConfig(item);
    Object.freeze(value);
  }
  return value;
};
