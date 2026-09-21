
import {FasterATR, FasterWSMA} from '../core-indicators/index.js';
import { mathLog } from '../utilities/math.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';

export const atr = (main, index, size, {lag, retLogs}) => {
  const { verticalOhlcv, instances } = main
  const baseKeyName = retLogs ? `ret_log_atr_${size}` : `atr_${size}`

  if (index === 0) {

    const {instances, verticalOhlcv} = main

    validateInputValues({ high: true, low: true, close: true }, verticalOhlcv, index, 'atr')

    instances[baseKeyName] = new FasterATR(size, FasterWSMA)

    initializeColumns(main, [{ key: baseKeyName, priceBased: true }], { lag })
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
  const currAtr = instance.isStable ? instance.getResult() : NaN;

  // Always push the MA value (even if NaN).
  main.pushToMain({ index, key: baseKeyName, value: Number.isNaN(currAtr) ? NaN : (retLogs ? mathLog(currAtr, curr.close) : currAtr) });

}
