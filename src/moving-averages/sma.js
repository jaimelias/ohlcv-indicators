
import {SMA} from 'trading-signals';

export const sma = (close, size) => {

  const col = getSMA(close, size)
 
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