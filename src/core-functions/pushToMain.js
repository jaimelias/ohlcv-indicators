export const pushToMain = ({main, index, key, value}) => {

    const {verticalOhlcv} = main

    verticalOhlcv[key][index] = value
}

export const areKeyValuesValid = (columns, index) => {

    if (columns.length === 0) return false
    for (let x = 0; x < columns.length; x++) {
        const val = columns[x][index]
        if (val == null || Number.isNaN(val)) return false
    }
    return true
}
