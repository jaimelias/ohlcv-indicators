
import {FasterEMA, FasterSMA} from 'trading-signals';

const indicatorClasses = {
  ema: FasterEMA, 
  sma: FasterSMA
}

export const movingAverages = (main, index, methodName, size, { target, lag }) => {

  

  const { verticalOhlcv, instances, priceBased } = main
  const suffix = (target !== 'close') ?  `_${target}` : ''
  const keyName = `${methodName}_${size}${suffix}`

  if (index === 0) {

    const {len} = main

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${methodName}.`
      );
    }

    // Create the main moving average instance.
    instances[keyName] = new indicatorClasses[methodName](size)

    verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)

    if(priceBased.has(target)){
      priceBased.add(keyName)
    }

    if(lag > 0)
    {
      main.lag([keyName], lag)
    }
  }

  // Retrieve the current price value
  const value = verticalOhlcv[target][index]
  const instance = instances[keyName]

  // Update the moving average instance.
  instance.update(value)

  let currMa = NaN

  try {
    currMa = instance.getResult()
  } catch (err) {

  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currMa })

  return true
}