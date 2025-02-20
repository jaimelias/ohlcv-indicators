
import {FasterEMA} from 'trading-signals'

export const ema = (main, index, size, {target}) => {

  const {verticalOhlcv, instances, priceBased} = main

  const value = verticalOhlcv.close[index]

  let prefix =  (typeof target === 'string' && verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}ema_${size}`

  if(index === 0)
  {
      instances[keyName] = new FasterEMA(size)
      verticalOhlcv[keyName] = [...main.nullArray]
      priceBased.push(keyName)
  }

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