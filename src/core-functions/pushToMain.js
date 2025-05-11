export const pushToMain = ({main, index, key, value}) => {

    const {verticalOhlcv} = main

    if(value === null || typeof value === 'undefined' || Number.isNaN(value))
    {
        main.invalidValueIndex = index
        verticalOhlcv[key][index] = value
        return false
    }

    verticalOhlcv[key][index] = value    

    return true
}