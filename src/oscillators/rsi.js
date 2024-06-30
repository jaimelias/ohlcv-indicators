import { getEMA } from "../moving-averages/ema.js";
import { findCrosses } from "../utilities.js";

export const RSI = (main, period = 14, smoothingPeriod = 14) => {

    const ohlcv = main.getData()
    const data = ohlcv['close'];
    const rsi = getRSI(main.BigNumber, data, period, smoothingPeriod)
    const suffix = `${period}_${smoothingPeriod}`

    for(let k in rsi)
    {
        main.addColumn(`${k}_${suffix}`, rsi[k]);
    }

}

export const getRSI = (BigNumber, data, period = 14, smoothingPeriod = 14) => {
    if (data.length < period) {
        return [];
    }

    const zero = new BigNumber(0);
    const hundred = new BigNumber(100);
    const one = new BigNumber(1);

    let rsi = [];
    let gain = zero;
    let loss = zero;

    // Calculate the initial gain and loss
    for (let i = 1; i <= period; i++) {
        const thisVal = new BigNumber(data[i]);
        const prevVal = new BigNumber(data[i - 1]);
        const change = thisVal.minus(prevVal);

        if (change.isLessThan(zero)) {
            loss = loss.plus(change.abs());
        } else {
            gain = gain.plus(change);
        }
    }

    // Calculate the first RSI value
    let avgGain = gain.dividedBy(period);
    let avgLoss = loss.dividedBy(period);
    let rs = avgLoss.isEqualTo(zero) ? zero : avgGain.dividedBy(avgLoss);
    rsi.push(hundred.minus(hundred.dividedBy(one.plus(rs))));

    // Calculate subsequent RSI values
    for (let i = period + 1; i < data.length; i++) {
        const thisVal = new BigNumber(data[i]);
        const prevVal = new BigNumber(data[i - 1]);
        const change = thisVal.minus(prevVal);

        if (change.isLessThan(zero)) {
            loss = change.abs();
            gain = zero;
        } else {
            gain = change;
            loss = zero;
        }

        avgGain = avgGain.times(period - 1).plus(gain).dividedBy(period);
        avgLoss = avgLoss.times(period - 1).plus(loss).dividedBy(period);
        rs = avgLoss.isEqualTo(zero) ? zero : avgGain.dividedBy(avgLoss);
        rsi.push(hundred.minus(hundred.dividedBy(one.plus(rs))));
    }

    const rsi_smoothed = getEMA(BigNumber, rsi, smoothingPeriod);
    const rsi_crosses = findCrosses(BigNumber, rsi, rsi_smoothed);

    return { rsi, rsi_smoothed, rsi_crosses};
};
