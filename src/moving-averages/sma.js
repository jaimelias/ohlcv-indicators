
export const SMA = (main, size) => {
    const ohlcv = main.getData()
    const data = ohlcv['close']
    const sma = getSMA(main.BigNumber, data, size)
    main.addColumn(`sma_${size}`, sma)
}


export const getSMA = (BigNumber, data, size) => {
  
    let result = []
    let sum = BigNumber(0)
    let arr = []
  
    for (let i = 0; i < data.length; i++) {
  
        arr.push(data[i])
        sum = sum.plus(data[i])
  
        if (arr.length > size) {
            sum = sum.minus(arr.shift())
        }
  
        if (i >= size - 1) {
            result.push(sum.dividedBy(size))
        } else {
  
          result.push(sum.dividedBy(arr.length))
        }
    }
  
    return result;
  }