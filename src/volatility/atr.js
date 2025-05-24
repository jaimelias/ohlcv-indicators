
import {FasterATR, FasterWSMA} from 'trading-signals';

export const atr = (main, index, size, {lag}) => {
  const { verticalOhlcv, instances } = main
  const keyName = `atr_${size}`

  if (index === 0) {

    const {instances, verticalOhlcv, arrayTypes, len, priceBased} = main

    instances[keyName] = new FasterATR(size, FasterWSMA)
    verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)

    priceBased.add(keyName)

    if(lag > 0)
    {
      main.lag([keyName], lag)
    }

    arrayTypes[keyName] = 'Float64Array'
  }

  // Retrieve the current price value.
  const value = {
      high: verticalOhlcv.high[index],
      low: verticalOhlcv.low[index],
      close: verticalOhlcv.close[index],
    } 
  const instance = instances[keyName]

  // Update the moving average instance.
  instance.update(value);
  let currMa = NaN;
  try {
    currMa = instance.getResult();
  } catch (err) {

  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currMa });

  return true;
}