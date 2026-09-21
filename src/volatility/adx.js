import { FasterADX } from 'trading-signals';
import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';

export const adx = (main, index, size, { lag, retLogs }) => {
  const { verticalOhlcv, instances, useFullNames } = main;

  const adxKey = retLogs ? `ret_log_adx_${size}` : `adx_${size}`;

  const instanceKey = `adx_${size}`;

  // Initialization on the first index.
  if (index === 0) {
    validateInputValues({ high: true, low: true, close: true }, verticalOhlcv, index, 'adx');

    if (!verticalOhlcv.hasOwnProperty('high')) {
      throw new Error('Property high not found in verticalOhlcv for adx.');
    }

    if (!verticalOhlcv.hasOwnProperty('low')) {
      throw new Error('Property low not found in verticalOhlcv for adx.');
    }

    if (!verticalOhlcv.hasOwnProperty('close')) {
      throw new Error('Property close not found in verticalOhlcv for adx.');
    }

    Object.assign(instances, {
      [instanceKey]: new FasterADX(size)
    });

    initializeColumns(main, [{ key: adxKey }], { lag });
  }

  const high = verticalOhlcv.high[index];
  const low = verticalOhlcv.low[index];
  const close = verticalOhlcv.close[index];

  let currentAdx = NaN;

  // Update the ADX indicator.
  instances[instanceKey].update({ high, low, close });

  try {
    currentAdx = instances[instanceKey].getResult();

    instances[instanceKey].get
  } catch (err) {
    currentAdx = NaN;
  }


  const adxVal = Number.isNaN(currentAdx)
    ? NaN
    : retLogs ? mathLog(currentAdx, 20) : currentAdx;


  main.pushToMain({ index, key: adxKey, value: adxVal });
};