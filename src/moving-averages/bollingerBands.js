
import {BollingerBands, FasterBollingerBands, Big} from 'trading-signals';

export const bollingerBands = (main, size, times) => {

  const {verticalOhlcv, precision} = main
  const {close} = verticalOhlcv

  const col = getBollingerBands(close, size, times, precision)
  return col
}

export const getBollingerBands = (data, size = 20, times = 2, precision) => {
  
  const dataLength = data.length
  const bollinger_bands_upper =  Array(dataLength).fill(null)
  const bollinger_bands_middle =  Array(dataLength).fill(null)
  const bollinger_bands_lower =  Array(dataLength).fill(null)
  const bollinger_bands_range =  Array(dataLength).fill(null)
  const bollinger_bands_diff =  Array(dataLength).fill(null)
  let range = null
  let diff = null

  let getRange
  let instance

  if (precision) {
    instance = new BollingerBands(size, times)
    getRange = (value, upper, lower) => ({
      range: ((value.minus(lower)).div((upper.minus(lower)))).times(100),
      diff: ((upper.minus(lower)).div(lower)).times(100)
    })
  } else {
    instance = new FasterBollingerBands(size, times)
    getRange = (value, upper, lower) => ({
      range: ((value - lower) / (upper - lower)) * 100,
      diff: ((upper-lower)/lower) * 100
    })
  }
  
  for (let x = 0; x < dataLength; x++) {
    let obj = {};
    instance.update(data[x])
    let hasNull = false

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
      bollinger_bands_diff[x] = null
    }
    else
    {
      const extraProps = getRange(data[x], obj.upper, obj.lower)
      range = extraProps.range
      diff = extraProps.diff
    }

    bollinger_bands_range[x] = range
    bollinger_bands_diff[x] = diff
  }

  return { bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower, bollinger_bands_range, bollinger_bands_diff };
}