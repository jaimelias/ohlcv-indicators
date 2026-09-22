export const pushToMain = ({main, index, key, value}) => {

    const {verticalOhlcv} = main

    verticalOhlcv[key][index] = value
}

export const areKeyValuesValid = (main, index, keyNames, columns = null) => {

    if (columns !== null) {
        if (columns.length === 0) return false
        for (let x = 0; x < columns.length; x++) {
            const val = columns[x][index]
            if (val == null || Number.isNaN(val)) return false
        }
        return true
    }
    
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

        if (val == null || Number.isNaN(val)) {
            output = false
            break
        }
    }

    return output
}
