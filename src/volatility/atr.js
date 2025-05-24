
import {FasterATR, FasterWSMA} from 'trading-signals';

export const atr = (main, index, size, {lag, tp, sl}) => {
  const { verticalOhlcv, instances } = main
  const keyName = `atr_${size}`

  if (index === 0) {

    const {instances, verticalOhlcv, arrayTypes, len, priceBased} = main

    instances[keyName] = new FasterATR(size, FasterWSMA)
    
    const keyNames = [keyName]

    if(tp !== null)
    {
      keyNames.push(`${keyName}_tp`)
    }

    if(sl !== null)
    {
       keyNames.push(`${keyName}_sl`)
    }

    for(const k of keyNames)
    {
      priceBased.add(k)
      verticalOhlcv[k] = new Float64Array(len).fill(NaN)
      arrayTypes[k] = 'Float64Array'
    }
    

    if(lag > 0)
    {
      main.lag(keyNames, lag)
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

  if(tp !== null)
  {
    main.pushToMain({ index, key: `${keyName}_tp`, value: (!Number.isNaN(currAtr)) ? curr.close + (currAtr*tp) : NaN });
  }

  if(sl !== null)
  {
    main.pushToMain({ index, key: `${keyName}_sl`, value: (!Number.isNaN(currAtr)) ? curr.close - (currAtr*sl) : NaN });
  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: keyName, value: currAtr });

  return true;
}