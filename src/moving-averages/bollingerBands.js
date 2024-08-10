
import {BollingerBands, FasterBollingerBands, Big} from 'trading-signals';

export const bollingerBands = (main, size, times) => {

  const {verticalOhlcv, precision} = main
  const {close} = verticalOhlcv

  const col = getBollingerBands(close, size, times, precision)
  return col
}

export const getBollingerBands = (data, size = 20, times = 2, precision) => {
  
  const output = {bollinger_bands_upper: [], bollinger_bands_middle: [], bollinger_bands_lower: []}
  const instance = (precision) ? new BollingerBands(size, times) : new FasterBollingerBands(size, times)

  for(let x = 0; x < data.length; x++) {
    let obj = {}
    instance.update(data[x])

    try
    {
        obj = instance.getResult()
    }
    catch(err)
    {
        obj = {upper: null, middle: null, lower: null}
    }

    output.bollinger_bands_upper.push(obj.upper)
    output.bollinger_bands_middle.push(obj.middle)
    output.bollinger_bands_lower.push(obj.lower)

  }

  const {bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower} = output
  const bollinger_bands_range = bollingerBandsRange(data, {bollinger_bands_upper, bollinger_bands_lower}, precision)

  return {bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower, bollinger_bands_range}
}
  


const bollingerBandsRange = (data, bollingerBands, precision) => {
  let { bollinger_bands_upper, bollinger_bands_lower } = bollingerBands
  
  let getRange

  if(precision)
  {
    data = data.filter(o => o instanceof Big)
    bollinger_bands_upper = bollinger_bands_upper.filter(o => o instanceof Big)
    bollinger_bands_lower = bollinger_bands_lower.filter(o => o instanceof Big)
    getRange = (value, upper, lower) => ((value.minus(lower)).div((upper.minus(lower)))).times(100)
  }
  else
  {
    data = data.filter(o => typeof o === 'number')
    bollinger_bands_upper = bollinger_bands_upper.filter(o => typeof o === 'number')
    bollinger_bands_lower = bollinger_bands_lower.filter(o => typeof o === 'number')
    getRange = (value, upper, lower) => ((value - lower) / (upper - lower)) * 100
  }

  const min = Math.min(data.length, bollinger_bands_upper.length, bollinger_bands_lower.length)

  data = data.slice(-min)
  bollinger_bands_upper = bollinger_bands_upper.slice(-min)
  bollinger_bands_lower = bollinger_bands_lower.slice(-min)

  const output = new Array(data.length)

  for (let i = 0; i < data.length; i++) {
    output[i] = getRange(data[i], bollinger_bands_upper[i], bollinger_bands_lower[i])
  }
  
  return output
}