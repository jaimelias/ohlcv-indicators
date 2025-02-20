
import {FasterSMA} from 'trading-signals';

export const sma = (main, index, size, {target}) => {

  const {verticalOhlcv, instances, priceBased} = main
  

  let prefix =  (typeof target === 'string' && verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}sma_${size}`


  if(index === 0)
  {
      if(!verticalOhlcv.hasOwnProperty(target))
      {
          throw new Error(`Target property ${target} not found in verticalOhlcv for sma.`)
      }

      instances[keyName] = new FasterSMA(size)
      verticalOhlcv[keyName] = [...main.nullArray]
      priceBased.push(keyName)
  }

  const value = verticalOhlcv[target][index]
  let currSma
  instances[keyName].update(value, main.lastIndexReplace)

  try{
    currSma = instances[keyName].getResult()
  } catch(err)
  {
    //do nothing
  }

  if(currSma)
  {
    main.pushToMain({index, key: keyName, value: currSma})
  }

}