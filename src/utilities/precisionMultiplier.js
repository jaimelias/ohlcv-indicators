export const calcPrecisionMultiplier = (main, firstRow) => {
    const {precision} = main

    if(precision === false) return 1

    let output = 1

    for(const [key, value] of Object.entries(firstRow))
    {
        if(new Set(['open', 'high', 'low', 'close']).has(key) === false) continue
        const [, decimals = ''] = String(value).split('.')
        const decimalPrecision = Math.max(4, decimals.length)
        const multiplier = decimalPrecision > 1 ? Math.pow(10, decimalPrecision - 1) : 1

        if(multiplier > output)
        {
            output = multiplier
        }
    }

    return output

}