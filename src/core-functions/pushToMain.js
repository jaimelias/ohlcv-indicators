export const pushToMain = ({main, index, key, value}) => {

    const {verticalOhlcv} = main

    verticalOhlcv[key][index] = value    

    return true
}

export const areKeyValuesValid = (main, index, keyNames) => {
    
    if(keyNames.length === 0) return false

    const {verticalOhlcv} = main

    let output = true

    for(let x = 0 ; x < keyNames.length; x++)
    {
        const key = keyNames[x]
        if(!verticalOhlcv.hasOwnProperty(key)) {
            output = false
            break
        }

        const val = verticalOhlcv[key][index]

        if (val == null || Number.isNaN(val) || !Number.isFinite(val)) {
            output = false;
            break;
        }
    }

    return output
}