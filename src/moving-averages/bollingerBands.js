
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

  let getRange
  let instance

  if (precision) {
    instance = new BollingerBands(size, times)
    getRange = (value, upper, lower) => ((value.minus(lower)).div((upper.minus(lower)))).times(100)
  } else {
    instance = new FasterBollingerBands(size, times)
    getRange = (value, upper, lower) => ((value - lower) / (upper - lower)) * 100
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
    bollinger_bands_range[x] = (hasNull) ? null : getRange(data[x], obj.upper, obj.lower)
  }

  return { bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower, bollinger_bands_range };
}