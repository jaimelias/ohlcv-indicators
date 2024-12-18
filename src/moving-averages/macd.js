import {FasterEMA, FasterMACD} from 'trading-signals';

export const macd = (main, index, fast, slow, signal) => {

    const value = main.verticalOhlcv.close[index]

    if (index === 0) {

        main.crossPairsList.push({fast: 'macd_diff', slow: 'macd_dea', isDefault: true});

        main.instances['macd'] = new FasterMACD(
            new FasterEMA(fast),
            new FasterEMA(slow),
            new FasterEMA(signal)
        );

        Object.assign(main.verticalOhlcv, {
            macd_diff: [...main.nullArray],
            macd_dea: [...main.nullArray],
            macd_histogram: [...main.nullArray],
        })
    }

    const macdInstance = main.instances[`macd`];
    macdInstance.update(value, main.lastIndexReplace);

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
