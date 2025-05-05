
import {FasterEMA, FasterSMA, FasterBollingerBands} from 'trading-signals';

const indicatorClasses = {ema: FasterEMA, sma: FasterSMA} 

export const movingAverages = (main, index, indicatorName, size, { target, lag }) => {
  const { verticalOhlcv, instances, priceBased, lastIndexReplace } = main;
  let suffix =
    typeof target === 'string' &&
    verticalOhlcv.hasOwnProperty(target) &&
    target !== 'close'
      ? `_${target}`
      : '';
  const keyName = `${indicatorName}_${size}${suffix}`;

  if (index === 0) {
    const { nullArray } = main;

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${indicatorName}.`
      );
    }

    // Create the main moving average instance.
    instances[keyName] = {
      maInstance: new indicatorClasses[indicatorName](size)
    };

    verticalOhlcv[keyName] = [...nullArray]
    priceBased.push(keyName);

    if(lag > 0)
    {
      main.lag([keyName], lag)
    }

  }

  // Retrieve the current price value.
  const value = verticalOhlcv[target][index];
  const { maInstance } = instances[keyName];

  // Update the moving average instance.
  maInstance.update(value, lastIndexReplace);
  let currMa = null;
  try {
    currMa = maInstance.getResult();
  } catch (err) {
    currMa = null;
  }

  // Always push the MA value (even if null).
  main.pushToMain({ index, key: keyName, value: currMa });

  return true;
}