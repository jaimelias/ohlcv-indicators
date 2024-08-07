
import {SMA, FasterSMA} from 'trading-signals';

export const sma = (main, size) => {

  const {verticalOhlcv, precision} = main
  const {close} = verticalOhlcv

  const col = getSMA(close, size, precision)
 
  return {
    [`sma_${size}`]: col
  }
}

export const getSMA = (data, size, precision) => {
  
  if(typeof precision === 'undefined' || typeof data === 'undefined' || typeof size === 'undefined')
  {
    throw Error('undefined param in getSMA')
  }

  const output = []
  const instance = (precision) ? new SMA(size) : new FasterSMA(size)
  const dataLength = data.length

  for(let x = 0; x < dataLength; x++)
  {
      let value = null
      instance.update(data[x])
    
      try
      {
        value = instance.getResult()
      }
      catch(err)
      {
        value = null
      }

      output.push(value)
  }

  return output
}