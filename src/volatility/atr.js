
import {FasterATR, FasterWSMA} from 'trading-signals';

export const atr = (main, index, size, {lag, type}) => {
  const { verticalOhlcv, instances } = main
  const keyName = (type === 'percentage') ? `atr_${size}_percentage`  : `atr_${size}` 

  if (index === 0) {

    const {instances, verticalOhlcv, arrayTypes, len, priceBased} = main

    instances[keyName] = new FasterATR(size, FasterWSMA)

    if(type === 'price')
    {
      priceBased.add(keyName)
    }
    
    verticalOhlcv[keyName] = new Float64Array(len).fill(NaN)
    arrayTypes[keyName] = 'Float64Array'
    
    if(lag > 0)
    {
      main.lag([keyName], lag)
    }
  }

  // Retrieve the current price value.
  const curr = {
      high: verticalOhlcv.high[index],
      low: verticalOhlcv.low[index],
      close: verticalOhlcv.close[index],
    } 
  const instance = instances[keyName]

  // Update the moving average instance.
  instance.update(curr);
  let currAtr = NaN;
  try {
    currAtr = instance.getResult();
  } catch (err) {

  }

  if(type === 'percentage')
  {
    currAtr = (Number.isNaN(currAtr)) ? NaN : (currAtr / curr.close)
  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currAtr });

  return true;
}