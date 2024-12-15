
import {FasterEMA} from 'trading-signals'

export const ema = (main, index, size) => {

  const value = main.verticalOhlcv.close[index]

  if(index === 0)
  {
      main.instances[`ema_${size}`] = new FasterEMA(size)
      main.verticalOhlcv[`ema_${size}`] = new Array(main.len).fill(null)
  }

  let currSma
  main.instances[`ema_${size}`].update(value)

  try{
    currSma = main.instances[`ema_${size}`].getResult()
  } catch(err)
  {
    currSma = null
  }

  if(currSma)
  {
    main.verticalOhlcv[`ema_${size}`][index] = currSma
  }

}