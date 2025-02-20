
import {FasterEMA} from 'trading-signals'

export const ema = (main, index, size, {target}) => {

  const {verticalOhlcv, instances, priceBased} = main


  let prefix =  (typeof target === 'string' && verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}ema_${size}`

  if(index === 0)
  {
    const {nullArray} = main

      if(!verticalOhlcv.hasOwnProperty(target))
      {
          throw new Error(`Target property ${target} not found in verticalOhlcv for ema.`)
      }

      instances[keyName] = new FasterEMA(size)
      verticalOhlcv[keyName] = [...nullArray]
      priceBased.push(keyName)
  }

  const value = verticalOhlcv[target][index]

  let currEma
  instances[keyName].update(value, main.lastIndexReplace)

  try{
    currEma = instances[keyName].getResult()
  } catch(err)
  {
    currEma = null
  }

  if(currEma)
  {
    main.pushToMain({index, key: keyName, value: currEma})
  }

}