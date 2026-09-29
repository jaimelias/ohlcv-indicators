
import {FasterEMA, FasterSMA} from '../core-indicators/index.js';
import { validateInputValues } from '../utilities/validators.js';
import { initializeColumns } from '../core-functions/initializeColumns.js';
import { mathLog } from '../utilities/math.js';

const isBadNumber = v => v == null || !Number.isFinite(v);


const indicatorClasses = {
  ema: FasterEMA, 
  sma: FasterSMA
}

export const movingAverages = (main, index, methodName, size, { target, lag, retLogs = false }) => {

  const { verticalOhlcv, instances, priceBased } = main
  const suffix = (target !== 'close') ?  `_${target}` : ''
  const keyName = `${retLogs ? 'ret_log_' : ''}${methodName}_${size}${suffix}`

  if (index === 0) {
    validateInputValues({ [target]: true }, verticalOhlcv, index, methodName)

    if (!verticalOhlcv.hasOwnProperty(target)) {
      throw new Error(
        `Target property ${target} not found in verticalOhlcv for ${methodName}.`
      );
    }

    // Create the main moving average instance.
    instances[keyName] = new indicatorClasses[methodName](size)

    if(retLogs) {
      initializeColumns(main, [
        { key: `${keyName}_distance`, priceBased: false },
        { key: `${keyName}_change`, priceBased: false }
      ], { lag })
    } else {
      initializeColumns(main, [{ key: keyName, priceBased: priceBased.has(target) }], { lag })
    }
    
  }

  // Retrieve the current price value
  const currVal = verticalOhlcv[target][index];


  if(isBadNumber(currVal)) return;

  const instance = instances[keyName];

  //The easiest way to compute prevMa change is to retrieve the previous result before updating the indicator.
  const prevMa = instance.isStable ? instance.getResult() : NaN;

  // Update the moving average instance.
  instance.update(currVal)

  const currMa = instance.isStable ? instance.getResult() : NaN;

  if(isBadNumber(currMa)) return;

  if (retLogs) {

    const ratio = currVal / currMa;
    const distance = mathLog(currVal, currMa);

    main.pushToMain({ index, key: `${keyName}_distance`, value: distance })

    if(isBadNumber(prevMa)) return;

    const change = mathLog(currMa, prevMa);

    main.pushToMain({ index, key: `${keyName}_change`, value: change })
  } else {
    main.pushToMain({ index, key: keyName, value: currMa })
  }

}
