import { defaultMapColsCallback } from '../studies/mapCols.js';

export const CONFIG_VERSION = 1;
const mapCallbacks = new Map([['default', defaultMapColsCallback]]);

// Copy configuration without JSON's silent conversion of functions/NaN to null.
export const copyConfig = (value, allowFunctions = false, ancestors = new Set()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'function' && allowFunctions) return value;
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Configuration values must be JSON-safe: no undefined, non-finite numbers, or unregistered functions.');
  }
  if (ancestors.has(value)) throw new TypeError('Configuration must not contain circular references.');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Configuration must contain only plain objects and arrays.');
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Configuration must not contain symbol keys.');

  ancestors.add(value);
  const result = Array.isArray(value)
    ? Array.from(value, item => copyConfig(item, allowFunctions, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyConfig(item, allowFunctions, ancestors)]));
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

export const registerMapCallback = (name, callback) => {
  if (typeof name !== 'string' || !name || typeof callback !== 'function') {
    throw new TypeError('registerMapCallback requires a nonempty name and a function.');
  }
  if (mapCallbacks.has(name) && mapCallbacks.get(name) !== callback) {
    throw new Error(`mapCols callback "${name}" is already registered. Use a new versioned name.`);
  }
  mapCallbacks.set(name, callback);
};

export const resolveMapCallback = callback => {
  if (typeof callback === 'function') return callback;
  if (typeof callback === 'string' && mapCallbacks.has(callback)) return mapCallbacks.get(callback);
  throw new Error(`Unknown mapCols callback "${callback}". Register it before loading the configuration.`);
};

export const exportInputParams = inputParams => {
  const result = copyConfig(inputParams, true);
  for (const job of result) {
    if (job.key !== 'mapCols' || typeof job.params[1] !== 'function') continue;
    const entry = [...mapCallbacks].find(([, callback]) => callback === job.params[1]);
    if (!entry) {
      throw new Error('Cannot export an unregistered mapCols callback. Register it with OHLCV_INDICATORS.registerMapCallback(name, callback).');
    }
    job.params[1] = entry[0];
  }
  return copyConfig(result);
};
