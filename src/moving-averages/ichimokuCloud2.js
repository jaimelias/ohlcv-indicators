export const IchimokuCloud = (main, tenkan, kijun, senkou) => {

    const {ohlcv} = main
    const ichi = getIchimokuCloud(ohlcv, tenkan, kijun, senkou)

    console.log(JSON.stringify(ichi))
  
    for(let k in ichi)
    {
        //console.log(`${k} [length ${ichi[k].length}] [lastValue ${ichi[k][ichi[k].length -1]}]`)
        main.addColumn(`ichimoku_${k}`, ichi[k])


        console.log(ichi[k])
    }
}


const getIchimokuCloud = (ohlcv, tenkan, kijun, senkou) => {

    const instance = new ComputeIchimokuCloud(tenkan, kijun, senkou)
    const output = {conversion_line: [], base_line: [], leading_span_a: [], leading_span_b: [], lagging_span: []}

    ohlcv.close.forEach((value, index) => {
        const ichi = instance.nextValue(ohlcv.high[index], ohlcv.low[index], value)

        if(typeof ichi === 'object')
        {
            const {conversion_line, base_line, leading_span_a, leading_span_b, lagging_span} = ichi

            output.conversion_line.push(conversion_line)
            output.base_line.push(base_line)
            output.leading_span_a.push(leading_span_a)
            output.leading_span_b.push(leading_span_b)
            output.lagging_span.push(lagging_span)
        }
        else
        {
            output.conversion_line.push(null)
            output.base_line.push(null)
            output.leading_span_a.push(null)
            output.leading_span_b.push(null)
            output.lagging_span.push(null)
        }
    })


    return output
}


class ComputeIchimokuCloud {


    constructor(tenkan = 9, kijun = 26, senkou = 52) {
        this.tenkanSenPeriod = tenkan;
        this.kijunSenPeriod = kijun;
        this.senkouSpanBPeriod = senkou;

        this.high = []
        this.low = []
        this.close = []
    }

    nextValue(high, low, close) {
        this.high.push(high);
        this.low.push(low);
        this.close.push(close);

        if (this.high.length < this.kijunSenPeriod) {
            return;
        }

        const tenkanSen = this.calculateAverage(this.high, this.low, this.tenkanSenPeriod);
        const kijunSen = this.calculateAverage(this.high, this.low, this.kijunSenPeriod);
        const senkouSpanA = this.calculateSenkouSpanA(tenkanSen, kijunSen);
        const senkouSpanB = this.calculateSenkouSpanB(this.high, this.low);
        const chikouSpan = this.calculateChikouSpan(this.close);

        return {
            conversion_line: tenkanSen[tenkanSen.length - 1],
            base_line: kijunSen[kijunSen.length - 1],
            leading_span_a: senkouSpanA[senkouSpanA.length - 1],
            leading_span_b: senkouSpanB[senkouSpanB.length - 1],
            lagging_span: chikouSpan[chikouSpan.length - 1],
        };
    }

    momentValue(high, low, close) {
        const momentHigh = [...this.high, high];
        const momentLow = [...this.low, low];
        const momentClose = [...this.close, close];

        if (momentHigh.length < this.kijunSenPeriod) {
            return;
        }

        const tenkanSen = this.calculateAverage(momentHigh, momentLow, this.tenkanSenPeriod);
        const kijunSen = this.calculateAverage(momentHigh, momentLow, this.kijunSenPeriod);
        const senkouSpanA = this.calculateSenkouSpanA(tenkanSen, kijunSen);
        const senkouSpanB = this.calculateSenkouSpanB(momentHigh, momentLow);
        const chikouSpan = this.calculateChikouSpan(momentClose);

        return {
            conversion_line: tenkanSen[tenkanSen.length - 1],
            base_line: kijunSen[kijunSen.length - 1],
            leading_span_a: senkouSpanA[senkouSpanA.length - 1],
            leading_span_b: senkouSpanB[senkouSpanB.length - 1],
            lagging_span: chikouSpan[chikouSpan.length - 1],
        };
    }

    calculateAverage(high, low, period) {
        const result = [];
        const length = high.length;

        for (let i = 0; i <= length - period; i++) {
            let maxHigh = Math.max(...high.slice(i, i + period));
            let minLow = Math.min(...low.slice(i, i + period));

            result.push((maxHigh + minLow) / 2);
        }

        return result;
    }

    calculateSenkouSpanA(tenkanSen, kijunSen) {
        const spanA = [];
        const period = this.kijunSenPeriod - this.tenkanSenPeriod;

        for (let i = period; i < tenkanSen.length; i++) {
            spanA.push((tenkanSen[i] + kijunSen[i - period]) / 2);
        }

        return spanA.slice(0, spanA.length - this.kijunSenPeriod + 1);
    }

    calculateSenkouSpanB(high, low) {
        const spanB = [];

        for (let i = 0; i <= high.length - this.senkouSpanBPeriod; i++) {
            let maxHigh = Math.max(...high.slice(i, i + this.senkouSpanBPeriod));
            let minLow = Math.min(...low.slice(i, i + this.senkouSpanBPeriod));

            spanB.push((maxHigh + minLow) / 2);
        }

        return spanB.slice(0, spanB.length - this.kijunSenPeriod + 1);
    }

    calculateChikouSpan(close) {
        return close.slice(0, close.length - this.kijunSenPeriod + 1);
    }
}
