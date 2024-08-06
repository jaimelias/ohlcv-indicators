
import {EMA} from 'trading-signals'

export const ema = (close, size) => {

  const col = getEMA(close, size)

  return {
    [`ema_${size}`]: col
  }
}

export const getEMA = (data, size) => {
  
  const output = []
  const instance = new EMA(size)
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