
import {SMA} from 'trading-signals';

export const sma = (main, size) => {
  const {ohlcv} = main
  const data = ohlcv['close']
  const col = getSMA(data, size)
 
  return {
    [`sma_${size}`]: col
  }
}

export const getSMA = (data, size) => {
  
  const output = []
  const instance = new SMA(size)
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