import { FasterRSI, FasterSMA } from '../core-indicators/index.js';
import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';

const defaultTarget = 'close'
export const rsi = (main, index, size, { target, lag, retLogs }) => {

  
  
  const { verticalOhlcv, instances } = main;

  const suffix = target === defaultTarget ? '' : `_${target}`;
  const rsiKey = retLogs ? `ret_log_rsi_${size}${suffix}` : `rsi_${size}${suffix}`;
  const rsiSmaKey = retLogs ? `ret_log_rsi_sma_${size}${suffix}` : `rsi_sma_${size}${suffix}`;

  // Initialization on the first index.
  if (index === 0) {
    validateInputValues({ [target]: true }, verticalOhlcv, index, 'rsi');

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(`Target property ${target} not found in verticalOhlcv for rsi.`);
    }

    Object.assign(instances, {
      [rsiKey]: new FasterRSI(size),
      [rsiSmaKey]: new FasterSMA(size)
    })

    initializeColumns(main, [{ key: rsiKey }, { key: rsiSmaKey }], { lag });


  }

  const value = verticalOhlcv[target][index];

  // Update the RSI indicator.
  instances[rsiKey].update(value);

  const currentRsi = instances[rsiKey].isStable ? instances[rsiKey].getResult() : NaN;


    const rsiVal = Number.isNaN(currentRsi) ? NaN : (retLogs ? mathLog(currentRsi, 50) : currentRsi)

    main.pushToMain({ index, key: rsiKey, value: rsiVal });

    if (!Number.isNaN(currentRsi)) {
      instances[rsiSmaKey].update(currentRsi);
    }

    const smoothedRsi = instances[rsiSmaKey].isStable ? instances[rsiSmaKey].getResult() : NaN;

    const smoothedRsiVal = Number.isNaN(smoothedRsi) ? NaN : (retLogs ? mathLog(smoothedRsi, 50) : smoothedRsi)

    main.pushToMain({ index, key: rsiSmaKey, value: smoothedRsiVal });
};
