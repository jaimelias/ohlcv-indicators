
import {FasterEMA, FasterSMA, FasterBollingerBands} from 'trading-signals';
import { classifyBoll, calcZScore } from '../utilities/classification.js'

const indicatorClasses = {ema: FasterEMA, sma: FasterSMA} 

export const movingAverages = (main, index, indicatorName, size, { target, diff }) => {
  const { verticalOhlcv, instances, priceBased, lastIndexReplace } = main;
  let suffix =
    typeof target === 'string' &&
    verticalOhlcv.hasOwnProperty(target) &&
    target !== 'close'
      ? `_${target}`
      : '';
  const keyName = `${indicatorName}_${size}${suffix}`;
  const diffKeyName = `${indicatorName}_${size}_diff${suffix}`;

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

    verticalOhlcv[keyName] = [...nullArray];

    // If diff configuration is provided, create the diff indicator.
    if (diff !== null) {
      instances[keyName].diffInstance = new FasterBollingerBands(
        diff.size,
        diff.stdDev
      );

      const lagDiffArr = [];

      for (const targetKey of diff.targets) {
        verticalOhlcv[`${diffKeyName}_${targetKey}`] = [...nullArray];

        if(diff.autoMinMax)
        {
          main.autoMinMaxKeys.push(`${diffKeyName}_${targetKey}`)
        }

        if (diff.lag > 0) {
          lagDiffArr.push(`${diffKeyName}_${targetKey}`);
        }
      }

      if (diff.lag > 0) {
        main.lag(lagDiffArr, diff.lag);
      }
    }

    priceBased.push(keyName);
  }

  // Retrieve the current price value.
  const value = verticalOhlcv[target][index];
  const { maInstance, diffInstance } = instances[keyName];

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

  // Process the diff values if a diff is requested.
  if (diff !== null) {
    for (const targetKey of diff.targets) {
      // Compute diffValue only if we have a valid MA value.
      let diffValue = null;
      if (currMa !== null && typeof currMa === 'number') {
        diffValue = verticalOhlcv[targetKey][index] - currMa;
      }

      // Update the diff indicator only if diffValue is a valid number.
      if (diffValue !== null && typeof diffValue === 'number') {
        diffInstance.update(Math.abs(diffValue), lastIndexReplace);
      }

      let diffBoll = null;
      try {
        diffBoll = diffInstance.getResult();
      } catch (err) {
        diffBoll = null;
      }

      const classified = classifyBoll(diffValue, diffBoll, diff.scale, diff.autoMinMax);
      main.pushToMain({
        index,
        key: `${diffKeyName}_${targetKey}`,
        value: classified
      });
    }
  }

  return true;
};


export const getMovingAveragesParams = (indicatorName, size, options, validMagnitudeValues) => {
  if (!options || typeof options !== 'object') {
    throw new Error(`"options" must be an object in ${indicatorName}. eg: {target, height, range}`);
  }

  let { target = 'close', diff = null } = options;

  if(typeof target !== 'string')
  {
    throw new Error(`"target" must be a valid keyName ${indicatorName}.`);
  }

  if (typeof size !== 'number' || size <= 0) {
    throw new Error(`"size" must be a positive number in ${indicatorName}.`);
  }

  //diff can be null, true, false or an object with optional {stdDev, scale, targets, and size}
  const optionArgs = { target, diff: null };

  if (diff !== null && (typeof diff === 'object' || (typeof diff === 'boolean' && diff === true))) {

    diff = (diff === true) ? ({}) : diff

    const {
      stdDev = 2,
      scale = 0.05,
      targets = ['close'],
      size: diffSize = size,
      lag = 0,
      autoMinMax = false
    } = diff;

    if (typeof stdDev !== 'number' || stdDev <= 0) {
      throw new Error(`"diff.stdDev" must be a number greater than 0 in ${indicatorName}.`);
    }

    if (typeof scale !== 'number' || !validMagnitudeValues.includes(scale)) {
      throw new Error(`"diff.scale" must be a number between 0.01 and 1 in ${indicatorName}.`);
    }

    if (typeof diffSize !== 'number' || !Number.isInteger(diffSize) || diffSize <= 0) {
      throw new Error(`"diff.size" must be an integer greater than or equal to size in ${indicatorName}.`);
    }

    if (!Array.isArray(targets)) {
      throw new Error(`"diff.targest" must be an array of keyNames with at least 1 item in ${indicatorName}.`);
    }

    if (typeof lag !== 'number' || !Number.isInteger(lag) || lag < 0) {
      throw new Error(`"diff.lag" must be an integer greater than 0 in ${indicatorName}.`);
    }

    if (typeof autoMinMax !== 'boolean') {
      throw new Error(`"diff.autoMinMax" must be an boolean in ${indicatorName}.`);
    }

    optionArgs.diff = { stdDev, scale, size: diffSize, targets, lag, autoMinMax};
  }

  return optionArgs;
}