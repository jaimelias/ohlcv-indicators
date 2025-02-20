
import {FasterSMA} from 'trading-signals';

export const sma = (main, index, size, {target}) => {

  const {verticalOhlcv, instances, priceBased} = main
  const value = verticalOhlcv.close[index]

  let prefix =  (typeof target === 'string' && verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}sma_${size}`


  if(index === 0)
  {
      instances[keyName] = new FasterSMA(size)
      verticalOhlcv[keyName] = [...main.nullArray]
      priceBased.push(keyName)
  }

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