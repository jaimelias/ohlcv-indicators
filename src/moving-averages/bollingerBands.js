import { getSMA } from "./sma.js";


export const BollingerBands = (main, size, times) => {
  const ohlcv = main.getData()
  const suffix = `${size}_${times}`
  const data = ohlcv['close'];
  const bb = getBollingerBands(main.BigNumber, data, size, times)
  const {upper, mid, lower} = bb
  main.addColumn(`bollinger_bands_upper`, upper)
  main.addColumn(`bollinger_bands_mid`, mid)
  main.addColumn(`bollinger_bands_lower`, lower)
}



export const getBollingerBands = (BigNumber, data, size = 20, times = 2) => {
    // Ensure times is a BigNumber
    times = new BigNumber(times)
  
    const avg = getSMA(BigNumber, data, size)
    const sd = deviation(BigNumber, data, size)
  
    // Ensure timesSd is correctly calculated
    const timesSd = sd.map(o => o.times(times))
  
    // Correct the mapping of upper and lower bands
    let upper = avg.map((o, i) => o.plus(timesSd[i]))
    let mid = avg
    let lower = avg.map((o, i) => o.minus(timesSd[i]))
  
    return { upper, mid, lower }
  };
  
  const deviation = (BigNumber, data, size) => {
    const zero = new BigNumber(0)
    const length = data.length
    const avg = getSMA(BigNumber, data, size)
    const ret = new Array(length).fill(zero) // Initialize ret array with zeros
  
    for (let i = size - 1; i < length; i++) {
      let sum = zero
  
      for (let j = i - size + 1; j <= i; j++) {
        sum = sum.plus(data[j].minus(avg[i]).pow(2))
      }
  
      ret[i] = sum.dividedBy(size).sqrt()
    }
  
    return ret
  };
  