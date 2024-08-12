
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

  const dataLength = data.length
  const output = new Array(dataLength).fill(null)
  const instance = (precision) ? new SMA(size) : new FasterSMA(size)
  

  for(let x = 0; x < dataLength; x++)
  {
      let value = null

      if(data[x] !== null)
      {
        instance.update(data[x])
      
        try
        {
          value = instance.getResult()
        }
        catch(err)
        {
          value = null
        }
      }

      output[x] = value
  }

  return output
}