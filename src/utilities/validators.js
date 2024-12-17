export const validateDate = dateString => typeof dateString === 'string' &&  /^\d{4}-\d{2}-\d{2}/.test(dateString)


export const validateInputParams = main => {

    const {inputParams, len} = main

    for (const { params } of inputParams) {
        for (const v of params) {
            if (typeof v === 'number' && v > len) {
                console.log(v, len);
                throw new Error('At least one of the params of the indicator is greater than the input OHLCV length. Make sure to have enough datapoints in the input OHLCV.');
            }
        }
    }
}

export const isAlreadyComputed = main => {
    if(main.lastComputedIndex !== 0) throw Error('ohlcv is already computed, you can not add new indicators after "compute", "getLastValues" or "getData" methods are called.')
}