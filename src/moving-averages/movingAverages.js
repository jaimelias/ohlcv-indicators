
import {FasterEMA, FasterSMA, FasterBollingerBands} from 'trading-signals';

const indicatorClasses = {ema: FasterEMA, sma: FasterSMA} 

export const movingAverages = (main, index, indicatorName, size, { target, lag }) => {
  const { verticalOhlcv, instances, priceBased } = main;
  let suffix =
    typeof target === 'string' &&
    verticalOhlcv.hasOwnProperty(target) &&
    target !== 'close'
      ? `_${target}`
      : '';
  const keyName = `${indicatorName}_${size}${suffix}`;

  if (index === 0) {
    const { len, arrayTypes } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${indicatorName}.`
      );
    }

    // Create the main moving average instance.
    instances[keyName] = {
      maInstance: new indicatorClasses[indicatorName](size)
    };

    verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)
    priceBased.push(keyName);

    if(lag > 0)
    {
      main.lag([keyName], lag)
    }

    arrayTypes[keyName] = 'Float64Array'

  }

  // Retrieve the current price value.
  const value = verticalOhlcv[target][index];
  const { maInstance } = instances[keyName];

  // Update the moving average instance.
  maInstance.update(value);
  let currMa = NaN;
  try {
    currMa = maInstance.getResult();
  } catch (err) {
    currMa = NaN;
  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currMa });

  return true;
}