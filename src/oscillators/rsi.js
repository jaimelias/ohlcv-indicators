import { FasterRSI } from 'trading-signals';
import { FasterSMA } from 'trading-signals';
import { mathLog } from '../utilities/math.js';

const defaultTarget = 'close'
export const rsi = (main, index, size, { target, lag, retLogs }) => {

  
  
  const { verticalOhlcv, instances } = main;

  const suffix = target === defaultTarget ? '' : `_${target}`;
  const rsiKey = retLogs ? `ret_log_rsi_${size}${suffix}` : `rsi_${size}${suffix}`;
  const rsiSmaKey = retLogs ? `ret_log_rsi_sma_${size}${suffix}` : `rsi_sma_${size}${suffix}`;

  // Initialization on the first index.
  if (index === 0) {

    const {len } = main;

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


    const rsiVal = Number.isNaN(currentRsi) ? NaN : (retLogs ? mathLog(currentRsi, 50) : currentRsi)

    main.pushToMain({ index, key: rsiKey, value: rsiVal });

    if (!Number.isNaN(currentRsi)) {
      instances[rsiSmaKey].update(currentRsi);
    }

    try {
      smoothedRsi = instances[rsiSmaKey].getResult();
    } catch (err) {
      smoothedRsi = NaN;
    }

    const smoothedRsiVal = Number.isNaN(smoothedRsi) ? NaN : (retLogs ? mathLog(smoothedRsi, 50) : smoothedRsi)

    main.pushToMain({ index, key: rsiSmaKey, value: smoothedRsiVal });
};
