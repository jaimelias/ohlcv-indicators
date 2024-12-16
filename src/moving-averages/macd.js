import {FasterEMA, FasterMACD} from 'trading-signals';

export const macd = (main, index, fast, slow, signal) => {

    const value = main.verticalOhlcv.close[index]

    if (index === 0) {

        main.crossPairsList.push({fast: 'macd_diff', slow: 'macd_dea'});

        main.instances['macd'] = new FasterMACD(
            new FasterEMA(fast),
            new FasterEMA(slow),
            new FasterEMA(signal)
        );

        Object.assign(main.verticalOhlcv, {
            macd_diff: new Array(main.len).fill(null),
            macd_dea: new Array(main.len).fill(null),
            macd_histogram: new Array(main.len).fill(null),
        })
    }

    const macdInstance = main.instances[`macd`];
    macdInstance.update(value);

    let macdResult;
    
    try {
        macdResult = macdInstance.getResult();
    } catch (err) {
        //do nothing
    }


    if (macdResult) {
        main.verticalOhlcv['macd_diff'][index] = macdResult.macd;
        main.verticalOhlcv['macd_dea'][index] = macdResult.signal;
        main.verticalOhlcv['macd_histogram'][index] = macdResult.histogram;
    }

    return true;
};
