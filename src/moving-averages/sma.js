
import {FasterSMA} from 'trading-signals';

export const sma = (main, index, size) => {

  const value = main.verticalOhlcv.close[index]

  if(index === 0)
  {
      main.instances[`sma_${size}`] = new FasterSMA(size)
      main.verticalOhlcv[`sma_${size}`] = new Array(main.len).fill(null)
  }

  let currSma
  main.instances[`sma_${size}`].update(value)

  try{
    currSma = main.instances[`sma_${size}`].getResult()
  } catch(err)
  {
    //do nothing
  }

  if(currSma)
  {
    main.verticalOhlcv[`sma_${size}`][index] = currSma
  }

}