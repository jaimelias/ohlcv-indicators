import {FasterEMA, FasterMACD} from 'trading-signals';

export const macd = (main, index, fastLine = 12, slowLine = 26, signalLine = 9) => {

    const value = main.verticalOhlcv.close[index]

    if (!main.instances.hasOwnProperty('macd')) {

        main.autoCrossPairsList.push({fast: 'macd_diff', slow: 'macd_dea'});

        main.instances['macd'] = new FasterMACD(
            new FasterEMA(fastLine),
            new FasterEMA(slowLine),
            new FasterEMA(signalLine)
        );

        main.verticalOhlcv['macd_diff'] = new Array(main.len).fill(null);
        main.verticalOhlcv['macd_dea'] = new Array(main.len).fill(null);
        main.verticalOhlcv['macd_histogram'] = new Array(main.len).fill(null);
    }

    const macdInstance = main.instances[`macd`];
    macdInstance.update(value);

    let macdResult;
    try {
        macdResult = macdInstance.getResult();
    } catch (err) {
        macdResult = { macd: null, signal: null, histogram: null };
    }

    const { macd, signal, histogram } = macdResult;

    if (macd !== null) {
        main.verticalOhlcv['macd_diff'][index] = macd;
    }

    if (signal !== null) {
        main.verticalOhlcv['macd_dea'][index] = signal;
    }

    if (histogram !== null) {
        main.verticalOhlcv['macd_histogram'][index] = histogram;
    }

    return true;
};
