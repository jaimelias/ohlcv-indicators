
import {BollingerBands, Big} from 'trading-signals';


export const bollingerBands = (main, size, times) => {
  const {ohlcv} = main
  const data = ohlcv['close'];
  const sliceData = data.slice(-(size*3))
  const col = getBollingerBands(sliceData, size, times)
  return col
}

export const getBollingerBands = (data, size = 20, times = 2) => {

  const dataLength = data.length
  const output = {bollinger_bands_upper: [], bollinger_bands_middle: [], bollinger_bands_lower: []}
  const instance = new BollingerBands(size, times)

  for(let x = 0; x < dataLength; x++) {
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
  const bollinger_bands_range = bollingerBandsRange(data, {bollinger_bands_upper, bollinger_bands_lower})

  return {bollinger_bands_upper, bollinger_bands_middle, bollinger_bands_lower, bollinger_bands_range}
}
  


const bollingerBandsRange = (data, bollingerBands) => {
  const { bollinger_bands_upper, bollinger_bands_lower } = bollingerBands;
  const output = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    if (bollinger_bands_upper[i] != null && bollinger_bands_lower[i] != null && data[i] != null) {
      const upperBig = new Big(bollinger_bands_upper[i]);
      const lowerBig = new Big(bollinger_bands_lower[i]);
      const dataBig = new Big(data[i]);

      const range = upperBig.minus(lowerBig);
      output[i] = dataBig.minus(lowerBig).div(range).times(100)
    } else {
      output[i] = null;
    }
  }
  
  return output;
}