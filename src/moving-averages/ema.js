
import {EMA} from 'trading-signals';


export const ema = (main, size) => {
  const {ohlcv} = main
  const data = ohlcv['close']
  const col = getEMA(data, size)
  main.addColumn(`ema_${size}`, col)
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