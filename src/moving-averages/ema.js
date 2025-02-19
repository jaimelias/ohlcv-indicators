
import {FasterEMA} from 'trading-signals'

export const ema = (main, index, size, {target}) => {

  const value = main.verticalOhlcv.close[index]

  let prefix =  (typeof target === 'string' && main.verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}ema_${size}`

  if(index === 0)
  {
      main.instances[keyName] = new FasterEMA(size)
      main.verticalOhlcv[keyName] = [...main.nullArray]
  }

  let currEma
  main.instances[keyName].update(value, main.lastIndexReplace)

  try{
    currEma = main.instances[keyName].getResult()
  } catch(err)
  {
    currEma = null
  }

  if(currEma)
  {
    main.pushToMain({index, key: keyName, value: currEma})
  }

}