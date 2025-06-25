export const pushToMain = ({main, index, key, value}) => {

    const {verticalOhlcv} = main

    verticalOhlcv[key][index] = value    

    return true
}