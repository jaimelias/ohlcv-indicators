export const priceVariations = (main, index) => {


    if(index === 0)
    {
        main.priceBased = [...new Set([...main.priceBased, 'mid_price_open_close', 'mid_price_high_low'])]

        Object.assign(main.verticalOhlcv, {
            mid_price_open_close: [...main.nullArray],
            mid_price_high_low: [...main.nullArray]
        })


    }

    const open = main.verticalOhlcv.open[index]
    const high = main.verticalOhlcv.high[index]
    const low = main.verticalOhlcv.low[index]
    const close = main.verticalOhlcv.close[index]
    main.verticalOhlcv.mid_price_open_close[index] = (open + close) / 2
    main.verticalOhlcv.mid_price_high_low[index] = (high + low) / 2
}