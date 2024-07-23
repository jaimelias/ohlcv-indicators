import OHLCV_INDICATORS from '../index.js'
import { getOHLCV } from './fetchLiveData.js'

const indicators = new OHLCV_INDICATORS()
const {BigNumber, VolumeProfile} = indicators

const TEST = async () => {  
  
  const unparsedOHLCV = await getOHLCV('ADMA', 200)

  indicators
    .init(unparsedOHLCV)
    //.EMA(21)
    //.EMA(9, 'ema21')
    //.SMA(200)
    //.SMA(100, 'sma_200')
    //.MACD(12, 26, 9)
    //.BollingerBands(20, 2)
    .IchimokuCloud(9, 26, 52)
    .RSI(14)
    //.MFI(14)
    //.RelativeVolume(10)
    //.RelativeVolume(20)
    .crossPairs([{fast: 'ema_9', slow: 'ema_21'}, {fast: 'close', slow: 'sma_200'}, {fast: 'rsi_14', slow: 70}])

  console.log(indicators.getLastValues())
  //console.log(VolumeProfile(BigNumber, indicators.getData(), 5))
}

TEST()