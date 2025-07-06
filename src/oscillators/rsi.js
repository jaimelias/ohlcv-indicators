import { FasterRSI } from 'trading-signals';
import { FasterSMA } from 'trading-signals';

const defaultTarget = 'close'
export const rsi = (main, index, size, { target, lag, parser, prefix, minmax }) => {

  
  
  const { verticalOhlcv, instances, notNumberKeys } = main;

  const suffix = target === defaultTarget ? '' : `_${target}`;
  const rsiKey = `${prefix}rsi_${size}${suffix}`;
  const rsiSmaKey = `${prefix}rsi_sma_${size}${suffix}`;

  // Initialization on the first index.
  if (index === 0) {

    const {len, arrayTypes } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for rsi.`);
    }

    Object.assign(instances, {
      [rsiKey]: new FasterRSI(size),
      [rsiSmaKey]: new FasterSMA(size)
    })

    Object.assign(verticalOhlcv, {
      [rsiKey]: new Float64Array(len).fill(NaN),
      [rsiSmaKey]: new Float64Array(len).fill(NaN),
    })

    const baseKeys = [rsiKey, rsiSmaKey]

    if (lag > 0) {
      main.lag(baseKeys, lag);
    }

    //[key, key_lag_1, …, key_lag_n] for each key
    const keyNames = lag > 0
      ? baseKeys.flatMap(key => [
          key,
          ...Array.from({ length: lag }, (_, i) => `${key}_lag_${i + 1}`)
        ])
      : baseKeys;

    if (Array.isArray(minmax)) {
      const group = main.scaledGroups.minmax_rsi ??= [];
      group.push(...keyNames);
    }

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
      notNumberKeys.add(key)
    }

  }

  const value = verticalOhlcv[target][index];
  let currentRsi = NaN;
  let smoothedRsi = NaN;

  // Update the RSI indicator.
  instances[rsiKey].update(value);

  try {
    currentRsi = instances[rsiKey].getResult();
  } catch (err) {
    currentRsi = NaN;
  }


  // Always push the RSI value, using NaN as a fallback.
  main.pushToMain({ index, key: rsiKey, value: (Number.isNaN(currentRsi)) ? NaN : parser(currentRsi) });

  // Update the SMA indicator only if a valid RSI value is available.
  if (!Number.isNaN(currentRsi)) {
    instances[rsiSmaKey].update(currentRsi);
  }

  try {
    smoothedRsi = instances[rsiSmaKey].getResult();
  } catch (err) {
    smoothedRsi = NaN;
  }

  // Always push the smoothed RSI value.
  main.pushToMain({ index, key: rsiSmaKey, value: (Number.isNaN(smoothedRsi)) ? NaN : parser(smoothedRsi) });
};
