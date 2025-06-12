export const validClassifiers = {
    'KNN': 'knn',
}

export const defaultYCallback = (index, verticalOhlcv) => {

    //this function will be executed inside a secondary loop after most of the indicates are calculated
    //use the "verticalOhlcv" object to access desired indicators

    const nextClose = verticalOhlcv.close[index + 1]
    const nextOpen = verticalOhlcv.open[index + 1]

    if(typeof nextClose === 'undefined') return null //return null the future value is undefined

    const nextNextClose = verticalOhlcv.close[index + 2]
    const nextNextOpen = verticalOhlcv.open[index + 2]

    if(typeof nextNextClose === 'undefined') return null //return null the future value is undefined

    //the total length of item is this output must be equal to "options.yColumns" property
    return [Number(nextClose > nextOpen), Number(nextNextClose, nextNextOpen)]
}