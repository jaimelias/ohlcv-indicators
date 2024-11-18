
import {FasterBollingerBands, FasterSMA} from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const bollingerBands = (main, size, times) => {

  const {verticalOhlcv} = main
  const {close} = verticalOhlcv

  const col = getBollingerBands(close, size, times)
  return col
}

export const getBollingerBands = (data, size = 20, times = 2) => {
  
  const dataLength = data.length
  const bollinger_bands_upper =  Array(dataLength).fill(null)
  const bollinger_bands_middle =  Array(dataLength).fill(null)
  const bollinger_bands_lower =  Array(dataLength).fill(null)
  const bollinger_bands_range =  Array(dataLength).fill(null)
  const bollinger_bands_height =  Array(dataLength).fill(null)


  const heightInstance = new FasterSMA(size)

  let range = null
  let height = null

  let getRange = (value, upper, lower) => ({
    range: ((value - lower) / (upper - lower)),
    height: upper-lower
  })

  let instance = new FasterBollingerBands(size, times)

  
  for (let x = 0; x < dataLength; x++) {
    let obj = {};
    instance.update(data[x])
    let hasNull = false
    let heightMean


    try {
      obj = instance.getResult()
    } catch (err) {
      hasNull = true
      obj = { upper: null, middle: null, lower: null }
    }

    bollinger_bands_upper[x] = obj.upper;
    bollinger_bands_middle[x] = obj.middle;
    bollinger_bands_lower[x] = obj.lower;

    if(hasNull)
    {
      bollinger_bands_range[x] = null
      bollinger_bands_height[x] = null
    }
    else
    {
      const extraProps = getRange(data[x], obj.upper, obj.lower)
      range = extraProps.range
      height = extraProps.height

      heightInstance.update(height)

      try{
        heightMean = heightInstance.getResult()
      }
      catch(err)
      {
        heightMean = null
      }

    }

    bollinger_bands_range[x] = range
    bollinger_bands_height[x] = classifySize(height, heightMean, 1.5)
  }

  return { bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower, bollinger_bands_range, bollinger_bands_height }
}

