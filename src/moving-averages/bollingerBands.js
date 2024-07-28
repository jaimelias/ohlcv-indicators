import { BollingerBands } from '@debut/indicators';


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


  const output = {lower: [], middle: [], upper: []}
  const instance = new BollingerBands(size, times)

  data.forEach(c => {


    const bb = instance.nextValue(c)

    if(typeof bb === 'object')
    {
      const {lower, middle, upper} = bb
      output.lower.push(lower)
      output.middle.push(middle)
      output.upper.push(upper)

    }
    else
    {
      output.lower.push(null)
      output.middle.push(null)
      output.upper.push(null)    
    }
  })

  const range = bollingerBandsRange(data, {upper: output.upper, lower: output.lower})


  return {...output, range}

}
  


const bollingerBandsRange = (data, bollingerBands) => {
  let {upper, lower} = bollingerBands;

  const range = upper.map((v, i) => v - lower[i]);

  const output = data.map((v, i) => ((v - lower[i]) / range[i]) * 100);

  return output;
};