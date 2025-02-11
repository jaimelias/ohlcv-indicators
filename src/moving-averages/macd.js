import {FasterEMA, FasterMACD} from 'trading-signals';

const defaultTarget = 'close'

export const macd = (main, index, fast, slow, signal, options) => {

    const {target} = options
    const suffix = target === defaultTarget ? '' : `_${target}`;
    const indicatorKey = `${fast}_${slow}_${signal}${suffix}`;

    if (index === 0) {

        if(!main.verticalOhlcv.hasOwnProperty(target))
        {
            throw new Error(`Target property ${target} not found in verticalOhlcv for macd.`)
        }

        const numberOfIndicators = main.inputParams.filter(o => o.key === 'macd').length;
        const prefix =
          numberOfIndicators > 1
            ? `macd_${indicatorKey}`
            : `macd${suffix}`;

        main.crossPairsList.push({fast: `${prefix}_diff`, slow: `${prefix}_dea`, isDefault: true});

        if(!main.instances.hasOwnProperty('macd'))
        {
            main.instances.macd = {
                numberOfIndicators,
                settings: {}
              }
        }

        main.instances.macd.settings[indicatorKey] = new FasterMACD(
            new FasterEMA(fast),
            new FasterEMA(slow),
            new FasterEMA(signal)
        );

        Object.assign(main.verticalOhlcv, {
            [`${prefix}_diff`]: [...main.nullArray],
            [`${prefix}_dea`]: [...main.nullArray],
            [`${prefix}_histogram`]: [...main.nullArray],
        })
    }

    
    const subPrefix = main.instances.macd.numberOfIndicators > 1
        ? `macd_${indicatorKey}`
        : `macd${suffix}`;

    const macdInstance = main.instances.macd.settings[indicatorKey];
    const value = main.verticalOhlcv[target][index]
    macdInstance.update(value, main.lastIndexReplace);

    let macdResult;
    
    try {
        macdResult = macdInstance.getResult();
    } catch (err) {
        //do nothing
    }


    if (macdResult) {

        main.pushToMain({index, key: `${subPrefix}_diff`, value: macdResult.macd})
        main.pushToMain({index, key: `${subPrefix}_dea`, value: macdResult.signal})
        main.pushToMain({index, key: `${subPrefix}_histogram`, value: macdResult.histogram})
    }

    return true;
};
