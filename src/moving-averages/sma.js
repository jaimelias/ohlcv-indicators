
import { SMA } from '@debut/indicators';

export const sma = (main, size) => {
  const {ohlcv, compute} = main
  const data = ohlcv['close']
  const ema = getSMA(data, size, compute)
  main.addColumn(`sma_${size}`, ema)
}

export const getSMA = (data, size) => {
  

  const output = []
  const instance = new SMA(size)

  data.forEach(c => {

    output.push(instance.nextValue(c))

  })

  return output

}