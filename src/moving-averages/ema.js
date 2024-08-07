
import {EMA, FasterEMA} from 'trading-signals'

export const ema = (main, size) => {

  const {verticalOhlcv, precision} = main
  const {close} = verticalOhlcv

  const col = getEMA(close, size, precision)

  return {
    [`ema_${size}`]: col
  }
}

export const getEMA = (data, size, precision) => {
  

  if(typeof precision === 'undefined' || typeof data === 'undefined' || typeof size === 'undefined')
  {
    throw Error('undefined param in getEMA')
  }

  const output = []
  const instance = (precision) ? new EMA(size) : new FasterEMA(size)
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