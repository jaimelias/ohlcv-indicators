
import {FasterATR, FasterWSMA} from 'trading-signals';

export const atr = (main, index, size, {lag, percentage, upper, lower}) => {
  const { verticalOhlcv, instances } = main
  const baseKeyName = `atr_${size}`

  if (index === 0) {

    const {instances, verticalOhlcv, len} = main

    instances[baseKeyName] = new FasterATR(size, FasterWSMA)

    const keyNames = [baseKeyName]

    if(percentage) keyNames.push(`${baseKeyName}_percentage`)
    if(upper !== null) keyNames.push(`${baseKeyName}_upper`)
    if(lower !== null) keyNames.push(`${baseKeyName}_lower`)

    for(const k of keyNames)
    { 
      verticalOhlcv[k] = new Float64Array(len).fill(NaN)
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
  const instance = instances[baseKeyName]

  // Update the moving average instance.
  instance.update(curr);
  let currAtr = NaN;
  try {
    currAtr = instance.getResult();
  } catch (err) {

  }

  if(percentage)
  {
    const percentageValue = (Number.isNaN(currAtr)) ? NaN : (currAtr / curr.close)
    main.pushToMain({ index, key: `${baseKeyName}_percentage`, value: percentageValue });
  }
  if(upper !== null)
  {
    const upperValue = (Number.isNaN(currAtr)) ? NaN : (curr.close + (currAtr * upper))
    main.pushToMain({ index, key: `${baseKeyName}_upper`, value: upperValue });
  }
  if(lower !== null)
  {
    const lowerValue = (Number.isNaN(currAtr)) ? NaN : (curr.close - (currAtr * lower))
    main.pushToMain({ index, key: `${baseKeyName}_lower`, value: lowerValue });
  }

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: baseKeyName, value: currAtr });

  return true;
}