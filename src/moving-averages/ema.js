
import { EMA } from '@debut/indicators';


export const ema = (main, size) => {
  const {ohlcv} = main
  const data = ohlcv['close']
  const col = getEMA(data, size)
  main.addColumn(`ema_${size}`, col)
}

export const getEMA = (data, size) => {
  

  const output = []
  const instance = new EMA(size)

  data.forEach(c => {

    output.push(instance.nextValue(c))

  })

  return output

}