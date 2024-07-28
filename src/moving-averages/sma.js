
import { SMA } from '@debut/indicators';

export const sma = (main, size) => {
  const {ohlcv} = main
  const data = ohlcv['close']
  const col = getSMA(data, size)
  main.addColumn(`sma_${size}`, col)
}

export const getSMA = (data, size) => {
  

  const output = []
  const instance = new SMA(size)

  data.forEach(c => {

    output.push(instance.nextValue(c))

  })

  return output

}