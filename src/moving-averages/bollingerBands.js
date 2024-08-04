
import {BollingerBands, Big} from 'trading-signals';


export const bollingerBands = (main, size, times) => {
  const {ohlcv} = main
  const data = ohlcv['close'];
  const col = getBollingerBands(data, size, times)

  for(let k in col)
  {
    main.addColumn(`bollinger_bands_${k}`, col[k])
  }
}



export const getBollingerBands = (data, size = 20, times = 2) => {

  const dataLength = data.length
  const output = {upper: [], middle: [], lower: []}
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

    output.upper.push(obj.upper)
    output.middle.push(obj.middle)
    output.lower.push(obj.lower)

  }

  const range = bollingerBandsRange(data, {upper: output.upper, lower: output.lower})

  return {...output, range}
}
  


const bollingerBandsRange = (data, bollingerBands) => {
  const { upper, lower } = bollingerBands;
  const output = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    if (upper[i] != null && lower[i] != null && data[i] != null) {
      const upperBig = new Big(upper[i]);
      const lowerBig = new Big(lower[i]);
      const dataBig = new Big(data[i]);

      const range = upperBig.minus(lowerBig);
      output[i] = dataBig.minus(lowerBig).div(range).times(100).toNumber();
    } else {
      output[i] = null;
    }
  }

  return output;
}