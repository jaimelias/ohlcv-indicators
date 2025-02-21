
import {FasterEMA, FasterSMA, FasterBollingerBands} from 'trading-signals';
import { classifyBoll } from '../utilities/classification.js'

const indicatorClasses = {ema: FasterEMA, sma: FasterSMA} 

export const movingAverages = (main, index, indicatorName, size, {target, diff}) => {

  const {verticalOhlcv, instances, priceBased, lastIndexReplace} = main
  let suffix =  (typeof target === 'string' && verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `_${target}` : ''
  const keyName = `${indicatorName}_${size}${suffix}`
  const diffKeyName = `${indicatorName}_${size}_diff${suffix}`

  if(index === 0)
  {
      const {nullArray} = main

      if(!verticalOhlcv.hasOwnProperty(target))
      {
          throw new Error(`Target property ${target} not found in verticalOhlcv for ${indicatorName}.`)
      }

      instances[keyName] = {
        maInstance: new indicatorClasses[indicatorName](size)
      }

      verticalOhlcv[keyName] = [...nullArray]

      if(diff !== null)
      {
        instances[keyName].diffInstance = new FasterBollingerBands(diff.size, diff.stdDev)

        const lagDiffArr = []

        for(const targetKey of diff.targets)
        {
          verticalOhlcv[`${diffKeyName}_${targetKey}`] = [...nullArray]

          if(diff.lag > 0)
          {
            lagDiffArr.push(`${diffKeyName}_${targetKey}`)
          }
        }

        if(diff.lag > 0)
        {
          console.log(lagDiffArr, diff.lag)
          main.lag(lagDiffArr, diff.lag)
        }
      }

      priceBased.push(keyName)
  }

  const value = verticalOhlcv[target][index]
  const {maInstance, diffInstance} = instances[keyName]
  maInstance.update(value, lastIndexReplace)

  let currMa

  try{
    currMa = maInstance.getResult()
  } catch(err)
  {
    //do nothing
  }

  if(currMa)
  {
    main.pushToMain({index, key: keyName, value: currMa})

    if(diff === null)
    {
      return true
    }

    for(const targetKey of diff.targets)
    {

      const diffValue = (target === targetKey) ? value - currMa : verticalOhlcv[targetKey][index]

      diffInstance.update(Math.abs(diffValue), lastIndexReplace)

      let diffBoll

      try {
        diffBoll = diffInstance.getResult()
      } catch(err)
      {
        diffBoll = null
      }

      main.pushToMain({index, key: `${diffKeyName}_${targetKey}`, value: classifyBoll(diffValue, diffBoll, diff.scale)})      

    }



  }

}



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
      lag = 0
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

    optionArgs.diff = { stdDev, scale, size: diffSize, targets, lag };
  }

  return optionArgs;
}