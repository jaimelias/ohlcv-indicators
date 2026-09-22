
import {FasterEMA, FasterSMA} from '../core-indicators/index.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';
import { mathLog } from '../utilities/math.js';

const indicatorClasses = {
  ema: FasterEMA, 
  sma: FasterSMA
}

export const movingAverages = (main, index, methodName, size, { target, lag, retLogs = false }) => {

  const { verticalOhlcv, instances, priceBased } = main
  const suffix = (target !== 'close') ?  `_${target}` : ''
  const keyName = `${retLogs ? 'ret_log_' : ''}${methodName}_${size}${suffix}`

  if (index === 0) {
    validateInputValues({ [target]: true }, verticalOhlcv, index, methodName)

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${methodName}.`
      );
    }

    // Create the main moving average instance.
    instances[keyName] = new indicatorClasses[methodName](size)

    initializeColumns(main, [{ key: keyName, priceBased: !retLogs && priceBased.has(target) }], { lag })
  }

  // Retrieve the current price value
  const value = verticalOhlcv[target][index]
  const instance = instances[keyName]

  // Update the moving average instance.
  instance.update(value)

  const currMa = instance.isStable ? instance.getResult() : NaN

  let output = currMa
  if (retLogs) {
    const ratio = value / currMa
    // Log-relative distance is defined only for finite, positive ratios and operands.
    output = value > 0 && currMa > 0 && ratio > 0 && Number.isFinite(ratio)
      ? mathLog(ratio, 1)
      : NaN
  }

  // Always push the selected value (even if NaN).
  main.pushToMain({ index, key: keyName, value: output })
}
