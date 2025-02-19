
import {FasterSMA} from 'trading-signals';

export const sma = (main, index, size, {target}) => {

  const value = main.verticalOhlcv.close[index]

  let prefix =  (typeof target === 'string' && main.verticalOhlcv.hasOwnProperty(target) && target !== 'close') ? `${target}_` : ''
  const keyName = `${prefix}sma_${size}`


  if(index === 0)
  {
      main.instances[keyName] = new FasterSMA(size)
      main.verticalOhlcv[keyName] = [...main.nullArray]
  }

  let currSma
  main.instances[keyName].update(value, main.lastIndexReplace)

  try{
    currSma = main.instances[keyName].getResult()
  } catch(err)
  {
    //do nothing
  }

  if(currSma)
  {
    main.pushToMain({index, key: keyName, value: currSma})
  }

}