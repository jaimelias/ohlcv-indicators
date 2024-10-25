
import {EMA, FasterEMA} from 'trading-signals'

export const ema = (main, size) => {

  const {verticalOhlcv} = main
  const {close} = verticalOhlcv

  const col = getEMA(close, size)

  return {
    [`ema_${size}`]: col
  }
}

export const getEMA = (data, size) => {
  

  if(typeof data === 'undefined' || typeof size === 'undefined')
  {
    throw Error('undefined param in getEMA')
  }

  const dataLength = data.length
  const output = new Array(dataLength).fill(null)
  const instance = new FasterEMA(size)

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