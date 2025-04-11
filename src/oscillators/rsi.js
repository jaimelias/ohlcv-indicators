import { FasterRSI } from 'trading-signals';
import { FasterSMA } from 'trading-signals';
import { calcMagnitude } from '../utilities/numberUtilities.js';

const defaultTarget = 'close';

export const rsi = (main, index, size, { scale, target, lag }) => {
  const { verticalOhlcv, instances, lastIndexReplace } = main;
  const suffix = target === defaultTarget ? '' : `_${target}`;
  const rsiKey = `rsi_${size}${suffix}`;
  const rsiSmaKey = `rsi_sma_${size}${suffix}`;

  // Initialization on the first index.
  if (index === 0) {

    const { crossPairsList, nullArray } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for rsi.`);
    }

    crossPairsList.push({ fast: rsiKey, slow: rsiSmaKey, isDefault: true });

    Object.assign(instances, {
      [rsiKey]: new FasterRSI(size),
      [rsiSmaKey]: new FasterSMA(size)
    });

    Object.assign(verticalOhlcv, {
      [rsiKey]: [...nullArray],
      [rsiSmaKey]: [...nullArray],
    });

    if(lag > 0)
    {
      main.lag([rsiKey, rsiSmaKey], lag)
    }

  }

  const value = verticalOhlcv[target][index];
  let currentRsi = null;
  let smoothedRsi = null;

  // Update the RSI indicator.
  instances[rsiKey].update(value, lastIndexReplace);

  try {
    currentRsi = instances[rsiKey].getResult();
  } catch (err) {
    currentRsi = null;
  }

  if (currentRsi !== null && typeof currentRsi === 'number' && scale) {
    currentRsi = calcMagnitude(currentRsi, scale);
  }

  // Always push the RSI value, using null as a fallback.
  main.pushToMain({ index, key: rsiKey, value: currentRsi });

  // Update the SMA indicator only if a valid RSI value is available.
  if (currentRsi !== null && typeof currentRsi === 'number') {
    instances[rsiSmaKey].update(currentRsi, lastIndexReplace);
  }

  try {
    smoothedRsi = instances[rsiSmaKey].getResult();
  } catch (err) {
    smoothedRsi = null;
  }

  if (smoothedRsi !== null && typeof smoothedRsi === 'number' && scale) {
    smoothedRsi = calcMagnitude(smoothedRsi, scale);
  }

  // Always push the smoothed RSI value.
  main.pushToMain({ index, key: rsiSmaKey, value: smoothedRsi });
};
