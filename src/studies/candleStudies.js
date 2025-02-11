import { FasterSMA } from 'trading-signals';
import { classifySize } from '../utilities/classification.js';

export const candleStudies = (main, index, size, classify = true, classificationLevels = {}) => {

    const { changeLevel = 7, sizeLevel = 5 } = classificationLevels;

    if(index === 0)
    {
        Object.assign(main.verticalOhlcv, {
            candle_gap_size: [...main.nullArray],
            candle_body_size: [...main.nullArray],
            candle_top_size: [...main.nullArray],
            candle_bottom_size: [...main.nullArray],
            candle_shadow_size: [...main.nullArray],
            candle_close_direction: [...main.nullArray],
            candle_high_direction: [...main.nullArray],
            candle_low_direction: [...main.nullArray],
            candle_open_direction: [...main.nullArray],          
        })
    }

    // Ensure instances exist if classification is enabled
    if (classify && index === 0) {

        Object.assign(main.instances, {
            candleStudies: {
                topInstance: new FasterSMA(size),
                bottomInstance: new FasterSMA(size),
                gapInstance: new FasterSMA(size),
                bodySizeInstance: new FasterSMA(size),
                shadowSizeInstance: new FasterSMA(size),
                closeDirectionInstance: new FasterSMA(size),
                highDirectionInstance: new FasterSMA(size),
                lowDirectionInstance: new FasterSMA(size),
                openDirectionInstance: new FasterSMA(size)             
            }
        })
    }

    // If we do not have a previous candle, we cannot compute differences
    const prevOpen = main.verticalOhlcv.open[index-1]
    const prevHigh = main.verticalOhlcv.high[index-1]
    const prevLow = main.verticalOhlcv.low[index-1]
    const prevClose = main.verticalOhlcv.close[index-1]

    if (index === 0) return true;

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
        topInstance.update(Math.abs(topSize), main.lastIndexReplace);
        bottomInstance.update(Math.abs(bottomSize), main.lastIndexReplace);
        shadowSizeInstance.update(Math.abs(shadowSize), main.lastIndexReplace);
        gapInstance.update(gapSize, main.lastIndexReplace);
        bodySizeInstance.update(candleBodySize, main.lastIndexReplace);
        closeDirectionInstance.update(closeDirection, main.lastIndexReplace);
        highDirectionInstance.update(highDirection, main.lastIndexReplace);
        lowDirectionInstance.update(lowDirection, main.lastIndexReplace);
        openDirectionInstance.update(openDirection, main.lastIndexReplace);

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

        main.pushToMain({
            index, 
            key: 'candle_body_size', 
            value: isUp 
                ? classifySize(candleBodySize, bodySizeMean, 2, changeLevel)
                : -Math.abs(classifySize(candleBodySize, bodySizeMean, 2, changeLevel)) || 0
        })

        

        main.pushToMain({index, key: 'candle_gap_size', value: isUp
            ? classifySize(gapSize, gapMean, 2, changeLevel)
            : -Math.abs(classifySize(gapSize, gapMean, 2, changeLevel)) || 0})


        main.pushToMain({index, key: 'candle_close_direction', value: isUp
            ? classifySize(closeDirection, closeDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(closeDirection, closeDirectionMean, 2, changeLevel)) || 0})


        main.pushToMain({index, key: 'candle_high_direction', value: isUp
            ? classifySize(highDirection, highDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(highDirection, highDirectionMean, 2, changeLevel)) || 0})

        main.pushToMain({index, key: 'candle_low_direction', value: isUp
            ? classifySize(lowDirection, lowDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(lowDirection, lowDirectionMean, 2, changeLevel)) || 0})

        main.pushToMain({index, key: 'candle_open_direction', value: isUp
            ? classifySize(openDirection, openDirectionMean, 2, changeLevel)
            : -Math.abs(classifySize(openDirection, openDirectionMean, 2, changeLevel)) || 0})

        main.pushToMain({index, key: 'candle_top_size', value: classifySize(topSize, topSizeMean, 0.5, sizeLevel)})
        main.pushToMain({index, key: 'candle_bottom_size', value: classifySize(bottomSize, bottomSizeMean, 0.5, sizeLevel)})
        main.pushToMain({index, key: 'candle_shadow_size', value: classifySize(shadowSize, shadowSizeMean, 0.5, sizeLevel)})

    } else {
        // Without classification, just store raw values

        main.pushToMain({index, key: 'candle_body_size', value: isUp ? candleBodySize : -candleBodySize})
        main.pushToMain({index, key: 'candle_gap_size', value: isUp ? gapSize : -gapSize})
        main.pushToMain({index, key: 'candle_close_direction', value: isUp ? closeDirection : -closeDirection})
        main.pushToMain({index, key: 'candle_high_direction', value: isUp ? highDirection : -highDirection})
        main.pushToMain({index, key: 'candle_low_direction', value: isUp ? lowDirection : -lowDirection})
        main.pushToMain({index, key: 'candle_open_direction', value: isUp ? openDirection : -openDirection})
        main.pushToMain({index, key: 'candle_top_size', value: topSize})
        main.pushToMain({index, key: 'candle_bottom_size', value: bottomSize})
        main.pushToMain({index, key: 'candle_shadow_size', value: shadowSize})
    }

    return true;
};
