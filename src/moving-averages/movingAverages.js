
import {FasterEMA, FasterSMA} from 'trading-signals';

const indicatorClasses = {ema: FasterEMA, sma: FasterSMA} 

export const movingAverages = (main, index, indicatorName, size, { target, lag, precomputed }) => {
  const { verticalOhlcv, instances } = main
  const {keyName} = precomputed

  if (index === 0) {

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${indicatorName}.`
      );
    }
  }

  // Retrieve the current price value.
  const value = verticalOhlcv[target][index]
  const { maInstance } = instances[keyName]

  // Update the moving average instance.
  maInstance.update(value);
  let currMa = NaN;
  try {
    currMa = maInstance.getResult();
  } catch (err) {

  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currMa });

  return true;
}

export const precomputeMovingAverages = ({main, size, target, lag, methodName}) => {

  const {instances, verticalOhlcv, priceBased, arrayTypes, len} = main
  const suffix = (target !== 'close') ?  `_${target}` : ''
  const keyName = `${methodName}_${size}${suffix}`

    // Create the main moving average instance.
    instances[keyName] = {
      maInstance: new indicatorClasses[methodName](size)
    }

    verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)

    priceBased.add(keyName)

    if(lag > 0)
    {
      main.lag([keyName], lag)
    }

    arrayTypes[keyName] = 'Float64Array'
  
  return {keyName}
}