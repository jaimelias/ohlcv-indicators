export const IchimokuCloud = (main, tenkan, kijun, senkou) => {

  const {ohlcv} = main
  const ichi = getIchimokuCloud(main.BigNumber, ohlcv, tenkan, kijun, senkou)

  for(let k in ichi)
  {
      //console.log(`${k} [length ${ichi[k].length}] [lastValue ${ichi[k][ichi[k].length -1]}]`)
      main.addColumn(`ichimoku_${k}`, ichi[k])
  }
}


export const getIchimokuCloud = (BigNumber, data, tenkan = 9, kijun = 26, senkou = 52) => {
    const TENKAN_SEN_PERIOD = tenkan
    const KIJUN_SEN_PERIOD = kijun
    const SENKOU_SPAN_A_PERIOD = KIJUN_SEN_PERIOD-TENKAN_SEN_PERIOD
    const SENKOU_SPAN_B_PERIOD = senkou
    const { high, low, close } = data
    const tenkanSen = calculateAverage(high, low, TENKAN_SEN_PERIOD)
    const kijunSen = calculateAverage(high, low, KIJUN_SEN_PERIOD)
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
  
const calculateAverage = (high, low, period) => {
  const result = [];
  const length = high.length;

  for (let i = 0; i <= length - period; i++) {
    let maxHigh = high[i];
    let minLow = low[i];


    for (let j = 1; j < period; j++) {
      if (high[i + j].isGreaterThan(maxHigh)) {
        maxHigh = high[i + j];
      }
      if (low[i + j].isLessThan(minLow)) {
        minLow = low[i + j];
      }
    }

    result.push(maxHigh.plus(minLow).dividedBy(2));
  }

  return result;
};


const calculateSenkouSpanA = (tenkanSen, kijunSen, period, slice) => {
  const spanA = [];
  const length = tenkanSen.length;
  
  for (let i = period; i < length; i++) {
    if (i - period < kijunSen.length) {
      spanA.push(tenkanSen[i].plus(kijunSen[i - period]).dividedBy(2));
    }
  }
  
  return spanA.slice(0, spanA.length - slice + 1);
};

const calculateSenkouSpanB = (BigNumber, high, low, period, slice) => {
  let spanB = [];
  for (let i = 0; i <= high.length - period; i++) {
    let highSlice = high.slice(i, i + period);
    let lowSlice = low.slice(i, i + period);
  
    let maxHigh = BigNumber.maximum(...highSlice);
    let minLow = BigNumber.minimum(...lowSlice);
    let spanBValue = maxHigh.plus(minLow).dividedBy(2);
  
    spanB.push(spanBValue);
  }
  
  return spanB.slice(0, spanB.length - slice + 1);
  
}


const calculateChikouSpan = (close, kijunSenPeriod) => close.slice(0, close.length - kijunSenPeriod + 1)

