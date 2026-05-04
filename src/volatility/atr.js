
import {FasterATR, FasterWSMA} from 'trading-signals';
import { mathLog } from '../utilities/math.js';

export const atr = (main, index, size, {lag, retLogs}) => {
  const { verticalOhlcv, instances, priceBased } = main
  const baseKeyName = retLogs ? `ret_log_atr_${size}` : `atr_${size}`

  if (index === 0) {

    const {instances, verticalOhlcv, len} = main

    instances[baseKeyName] = new FasterATR(size, FasterWSMA)

    const keyNames = [baseKeyName]

    for(const k of keyNames)
    { 
      verticalOhlcv[k] = new Float64Array(len).fill(NaN)
      priceBased.add(k)
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

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: baseKeyName, value: Number.isNaN(currAtr) ? NaN : (retLogs ? mathLog(currAtr, curr.close) : currAtr) });

  return true;
}