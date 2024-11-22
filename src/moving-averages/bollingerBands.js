
import {FasterBollingerBands, FasterSMA} from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const bollingerBands = (main, size, times, bollingerBandsStudies) => {

  const {verticalOhlcv} = main
  const {close} = verticalOhlcv

  const col = getBollingerBands(close, size, times, bollingerBandsStudies)
  return col
}

export const getBollingerBands = (data, size = 20, times = 2, bollingerBandsStudies = false) => {
  
  const dataLength = data.length
  const bollinger_bands_upper =  Array(dataLength).fill(null)
  const bollinger_bands_middle =  Array(dataLength).fill(null)
  const bollinger_bands_lower =  Array(dataLength).fill(null)


  let bollinger_bands_range
  let bollinger_bands_height
  let heightInstance
  let range = null
  let height = null

  if(bollingerBandsStudies)
  {
    bollinger_bands_range =  Array(dataLength).fill(null)
    bollinger_bands_height =  Array(dataLength).fill(null)
    heightInstance = new FasterSMA(size)
  }

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

    if(bollingerBandsStudies === false) continue
    
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

  let output = { bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower }

  if(bollingerBandsStudies)
  {
    output = {...output, bollinger_bands_range, bollinger_bands_height}
  }

  return output
}

