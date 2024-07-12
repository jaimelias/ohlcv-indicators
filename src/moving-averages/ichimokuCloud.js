export const IchimokuCloud = (main, tenkan, kijun, senkou) => {

  const ohlcv = main.getData()
  const ichi = getIchimokuCloud(main.BigNumber, ohlcv, tenkan, kijun, senkou)

  for(let k in ichi)
  {
      console.log(`${k} [length ${ichi[k].length}] [lastValue ${ichi[k][ichi[k].length -1]}]`)
      main.addColumn(`ichimoku_${k}`, ichi[k])
  }
}


export const getIchimokuCloud = (BigNumber, data, tenkan = 9, kijun = 26, senkou = 52) => {
    const TENKAN_SEN_PERIOD = tenkan
    const KIJUN_SEN_PERIOD = kijun
    const SENKOU_SPAN_A_PERIOD = KIJUN_SEN_PERIOD-TENKAN_SEN_PERIOD
    const SENKOU_SPAN_B_PERIOD = senkou
    const { high, low, close } = data
    const tenkanSen = calculateAverage(BigNumber, high, low, TENKAN_SEN_PERIOD)
    const kijunSen = calculateAverage(BigNumber, high, low, KIJUN_SEN_PERIOD)
    const senkouSpanA = calculateSenkouSpanA(tenkanSen, kijunSen, SENKOU_SPAN_A_PERIOD, KIJUN_SEN_PERIOD)
    const senkouSpanB = calculateSenkouSpanB(BigNumber, high, low, SENKOU_SPAN_B_PERIOD, KIJUN_SEN_PERIOD)
    const chikouSpan = calculateChikouSpan(close, KIJUN_SEN_PERIOD)
  
    return  {
      conversion_line: tenkanSen,
      base_line: kijunSen,
      leading_span_a: senkouSpanA,
      leading_span_b: senkouSpanB,
      lagging_span: chikouSpan
    }
}
  
const calculateAverage = (BigNumber, high, low, period) => {

  return high.slice(0, high.length - period + 1).map((_, i) => {
    const highSlice = high.slice(i, i + period)
    const lowSlice = low.slice(i, i + period)
    return BigNumber.maximum(...highSlice).plus(BigNumber.minimum(...lowSlice)).dividedBy(2)
  });
}

const calculateSenkouSpanA = (tenkanSen, kijunSen, period, slice) => {
  const spanA =  tenkanSen.slice(period).map((value, i) =>
    i < kijunSen.length ? value.plus(kijunSen[i]).dividedBy(2) : null
  ).filter(val => val !== null)

  return spanA.slice(0, (spanA.length - slice)+1)
};

const calculateSenkouSpanB = (BigNumber, high, low, period, slice) => {
  let spanB = high.slice(period).map((_, i) => {  // Adjusted slicing
    const highSlice = high.slice(i, i + period)
    const lowSlice = low.slice(i, i + period)
    return BigNumber.maximum(...highSlice).plus(BigNumber.minimum(...lowSlice)).dividedBy(2)
  })

  return spanB.slice(0, (spanB.length -slice)+2)
}


const calculateChikouSpan = (close, kijunSenPeriod) => close.slice(0, close.length - kijunSenPeriod + 1)

