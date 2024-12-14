import { FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const candlesStudies = (main, index, size, classify = true, classificationLevels = {}) => {



    const { changeLevel = 7, sizeLevel = 5 } = classificationLevels;

    // Ensure arrays exist in main.verticalOhlcv
    const fields = [
        'candle_gap_size',
        'candle_body_size',
        'candle_top_size',
        'candle_bottom_size',
        'candle_shadow_size',
        'candle_close_direction',
        'candle_high_direction',
        'candle_low_direction',
        'candle_open_direction'
    ];

    for (const field of fields) {
        if (!main.verticalOhlcv.hasOwnProperty(field)) {
            main.verticalOhlcv[field] = new Array(main.len).fill(null);
        }
    }

    // Ensure instances exist if classification is enabled
    if (classify) {
        const instanceNames = [
            'topInstance',
            'bottomInstance',
            'gapInstance',
            'bodySizeInstance',
            'shadowSizeInstance',
            'closeDirectionInstance',
            'highDirectionInstance',
            'lowDirectionInstance',
            'openDirectionInstance'
        ];

        // Create a namespace for candle studies if it doesn't exist
        if (!main.instances.hasOwnProperty('candleStudies')) {
            main.instances.candleStudies = {};
        }

        // Create instances if they don't exist
        for (const name of instanceNames) {
            if (!main.instances.candleStudies.hasOwnProperty(name)) {
                main.instances.candleStudies[name] = new FasterSMA(size);
            }
        }
    }

    // If we do not have a previous candle, we cannot compute differences
    const prevOpen = main.verticalOhlcv.open[index-1]
    const prevHigh = main.verticalOhlcv.high[index-1]
    const prevLow = main.verticalOhlcv.low[index-1]
    const prevClose = main.verticalOhlcv.close[index-1]

    if ([prevOpen, prevHigh, prevLow, prevClose].some(v => typeof v === 'undefined')) return true;

    const currOpen = main.verticalOhlcv.open[index]
    const currHigh = main.verticalOhlcv.high[index]
    const currLow = main.verticalOhlcv.low[index]
    const currClose = main.verticalOhlcv.close[index]

    // Determine candle direction and sizes
    const isUp = currClose > currOpen;
    const candleBodySize = Math.abs(currClose - currOpen);
    const shadowSize = Math.abs(currHigh - currLow);

    const topSize = currHigh - Math.max(currOpen, currClose);
    const bottomSize = Math.min(currOpen, currClose) - currLow;
    const gapSize = Math.abs(prevClose - currOpen);
    const closeDirection = Math.abs(currClose - prevClose);
    const highDirection = Math.abs(currHigh - prevHigh);
    const lowDirection = Math.abs(currLow - prevLow);
    const openDirection = Math.abs(currOpen - prevOpen);

    let gapMean = null;
    let bottomSizeMean = null;
    let topSizeMean = null;
    let bodySizeMean = null;
    let shadowSizeMean = null;
    let closeDirectionMean = null;
    let highDirectionMean = null;
    let lowDirectionMean = null;
    let openDirectionMean = null;

    if (classify) {
        const {
            topInstance,
            bottomInstance,
            gapInstance,
            bodySizeInstance,
            shadowSizeInstance,
            closeDirectionInstance,
            highDirectionInstance,
            lowDirectionInstance,
            openDirectionInstance
        } = main.instances.candleStudies;

        // Update instances with current absolute values
        topInstance.update(Math.abs(topSize));
        bottomInstance.update(Math.abs(bottomSize));
        shadowSizeInstance.update(Math.abs(shadowSize));
        gapInstance.update(gapSize);
        bodySizeInstance.update(candleBodySize);
        closeDirectionInstance.update(closeDirection);
        highDirectionInstance.update(highDirection);
        lowDirectionInstance.update(lowDirection);
        openDirectionInstance.update(openDirection);

        try {
            topSizeMean = topInstance.getResult();
            bottomSizeMean = bottomInstance.getResult();
            gapMean = gapInstance.getResult();
            bodySizeMean = bodySizeInstance.getResult();
            shadowSizeMean = shadowSizeInstance.getResult();
            closeDirectionMean = closeDirectionInstance.getResult();
            highDirectionMean = highDirectionInstance.getResult();
            lowDirectionMean = lowDirectionInstance.getResult();
            openDirectionMean = openDirectionInstance.getResult();
        } catch (err) {
            // If there's not enough data, means remain null
        }

        main.verticalOhlcv['candle_body_size'][index] = isUp
            ? classifySize(candleBodySize, bodySizeMean, 2, changeLevel)
            : -Math.abs(classifySize(candleBodySize, bodySizeMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_gap_size'][index] = isUp
            ? classifySize(gapSize, gapMean, 2, changeLevel)
            : -Math.abs(classifySize(gapSize, gapMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_close_direction'][index] = isUp
            ? classifySize(closeDirection, closeDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(closeDirection, closeDirectionMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_high_direction'][index] = isUp
            ? classifySize(highDirection, highDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(highDirection, highDirectionMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_low_direction'][index] = isUp
            ? classifySize(lowDirection, lowDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(lowDirection, lowDirectionMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_open_direction'][index] = isUp
            ? classifySize(openDirection, openDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(openDirection, openDirectionMean, 2, changeLevel)) || 0;

        main.verticalOhlcv['candle_top_size'][index] = classifySize(topSize, topSizeMean, 0.5, sizeLevel);
        main.verticalOhlcv['candle_bottom_size'][index] = classifySize(bottomSize, bottomSizeMean, 0.5, sizeLevel);
        main.verticalOhlcv['candle_shadow_size'][index] = classifySize(shadowSize, shadowSizeMean, 0.5, sizeLevel);
    } else {
        // Without classification, just store raw values
        main.verticalOhlcv['candle_body_size'][index] = isUp ? candleBodySize : -candleBodySize;
        main.verticalOhlcv['candle_gap_size'][index] = isUp ? gapSize : -gapSize;
        main.verticalOhlcv['candle_close_direction'][index] = isUp ? closeDirection : -closeDirection;
        main.verticalOhlcv['candle_high_direction'][index] = isUp ? highDirection : -highDirection;
        main.verticalOhlcv['candle_low_direction'][index] = isUp ? lowDirection : -lowDirection;
        main.verticalOhlcv['candle_open_direction'][index] = isUp ? openDirection : -openDirection;

        main.verticalOhlcv['candle_top_size'][index] = topSize;
        main.verticalOhlcv['candle_bottom_size'][index] = bottomSize;
        main.verticalOhlcv['candle_shadow_size'][index] = shadowSize;
    }

    return true;
};
