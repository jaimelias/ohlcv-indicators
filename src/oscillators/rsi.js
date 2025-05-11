import { FasterRSI } from 'trading-signals';
import { FasterSMA } from 'trading-signals';

const defaultTarget = 'close'
export const rsi = (main, index, size, { target, lag }) => {
  const { verticalOhlcv, instances, lastIndexReplace } = main;

  const suffix = target === defaultTarget ? '' : `_${target}`;
  const rsiKey = `rsi_${size}${suffix}`;
  const rsiSmaKey = `rsi_sma_${size}${suffix}`;

  // Initialization on the first index.
  if (index === 0) {

    const { crossPairsList, len, arrayTypes } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for rsi.`);
    }

    crossPairsList.push({ fast: rsiKey, slow: rsiSmaKey, isDefault: true });

    Object.assign(instances, {
      [rsiKey]: new FasterRSI(size),
      [rsiSmaKey]: new FasterSMA(size)
    });

    Object.assign(verticalOhlcv, {
      [rsiKey]: new Float64Array(len).fill(NaN),
      [rsiSmaKey]: new Float64Array(len).fill(NaN),
    });



    const keyNames = [rsiKey, rsiSmaKey]

    if(lag > 0)
    {
      main.lag(keyNames, lag)
    }

    for(const key of keyNames)
    {
      arrayTypes[key] = 'Float64Array'
    }

  }

  const value = verticalOhlcv[target][index];
  let currentRsi = NaN;
  let smoothedRsi = NaN;

  // Update the RSI indicator.
  instances[rsiKey].update(value, lastIndexReplace);

  try {
    currentRsi = instances[rsiKey].getResult();
  } catch (err) {
    currentRsi = NaN;
  }


  // Always push the RSI value, using NaN as a fallback.
  main.pushToMain({ index, key: rsiKey, value: currentRsi });

  // Update the SMA indicator only if a valid RSI value is available.
  if (!Number.isNaN(currentRsi)) {
    instances[rsiSmaKey].update(currentRsi, lastIndexReplace);
  }

  try {
    smoothedRsi = instances[rsiSmaKey].getResult();
  } catch (err) {
    smoothedRsi = NaN;
  }

  // Always push the smoothed RSI value.
  main.pushToMain({ index, key: rsiSmaKey, value: smoothedRsi });
};
