import OHLCV_INDICATORS from '../index.js'
import { getOHLCV } from './fetchLiveData.js'

const indicators = new OHLCV_INDICATORS();
const {BigNumber} = indicators

const TEST = async () => {  
  
  const ohlcv = await getOHLCV('AAPL', 230)

  indicators
    .init(ohlcv)
    //.EMA(21)
    //.EMA(9, 'ema21')
    //.SMA(200)
    //.SMA(100, 'sma_200')
    //.MACD(12, 26, 9)
    .BollingerBands(20, 2)
    //.IchimokuCloud(9, 26, 52)
    .RSI(14)
    .MFI(14)
    .RelativeVolume(10)
    .RelativeVolume(20)
    .crossPairs([{fast: 'ema_9', slow: 'ema_21'}, {fast: 'close', slow: 'sma_200'}, {fast: 'rsi_14', slow: 30}])

  const dataSet = indicators.getData()
  

  for(let k in dataSet)
  {
    let firstValidIndex = 0
    const row = dataSet[k]
    const firstValue = (BigNumber.isBigNumber(row[0])) ? row[0].toNumber() : row[0]
    const lastValue = (BigNumber.isBigNumber(row[row.length -1])) ? row[row.length -1].toNumber() : row[row.length -1]

    //get the first numeric index
    row.forEach(v => {
      if(isNaN(v))
      {
        firstValidIndex++
      }
    })

    //console.log(`${k}: ${JSON.stringify({firstValue, firstValidIndex, lastValue})}`)
    //console.log('---\n')
  }

  //console.log('<<<<<<<<<< HEADERS >>>>>>>>>>')
  //console.log(indicators.getHeaders())

  console.log(indicators.getLastValues())
}

TEST()