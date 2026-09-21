import { buildArray } from '../utilities/assignTypes.js';
import { validateNumber } from '../utilities/validators.js';

// Called once by each indicator, inside its index === 0 block.
export const initializeColumns = (main, columns, { lag = 0 } = {}) => {
  const keyNames = [];
  const lagKeys = [];

  for (const {
    key,
    type = 'Float64Array',
    fill,
    enabled = true,
    priceBased = false,
    includeInLag = true
  } of columns) {
    if (!enabled) continue;

    if (Object.prototype.hasOwnProperty.call(main.verticalOhlcv, key)) {
      throw new Error(`Output column "${key}" already exists in verticalOhlcv.`);
    }

    // Integer arrays cannot represent the default missing value, NaN.
    if (/^(?:Int|Uint)/.test(type) && fill === undefined) {
      throw new Error(`Integer output column "${key}" requires an explicit fill value.`);
    }

    main.verticalOhlcv[key] = buildArray(type, main.len, fill);
    if (priceBased) main.priceBased.add(key);
    keyNames.push(key);
    if (includeInLag) lagKeys.push(key);
  }

  if (lag > 0 && lagKeys.length > 0) {
    validateNumber(lag, { min: 1, max: main.len }, 'lag', 'initializeColumns');
    main.executionParams.push({ key: 'lag', params: [lagKeys, lag] });
  }

  return keyNames;
};
