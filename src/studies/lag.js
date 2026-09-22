import { initializeColumns } from "../core-functions/initializeColumns.js"

const lagColumnsKey = Symbol('lagColumns')

export const lag = (main, index, colKeys, lookback) => {

  const { verticalOhlcv, priceBased, instances } = main

  if(index === 0)
  {
    const lagColumns = new Map()

    for (const target of colKeys) {
      if (!verticalOhlcv.hasOwnProperty(target)) {
        throw new Error(
        `Lag processing invoked by col "${target}" was not found in "verticalOhlcv".`
        )
      }

      const addToPriceBased = priceBased.has(target)
      const type = Array.isArray(verticalOhlcv[target]) ? 'Array' : 'Float64Array'
      const columns = []
      const keyNames = []

      for (let step = 1; step <= lookback; step++) {
        const key = `${target}_lag_${step}`

        columns.push({ key, type, priceBased: addToPriceBased, includeInLag: false })
        keyNames.push(key)
      }   

      initializeColumns(main, columns)
      lagColumns.set(target, keyNames)
    }

    // colKeys belongs to the runtime queue; keep cached names out of exported params.
    if (!instances[lagColumnsKey]) instances[lagColumnsKey] = new WeakMap()
    instances[lagColumnsKey].set(colKeys, lagColumns)
  }

  const lagColumns = instances[lagColumnsKey]?.get(colKeys)

  for (const target of colKeys) {
    const keyNames = lagColumns?.get(target)
    const currentColumn = verticalOhlcv[target]
    const missingValue = Array.isArray(currentColumn) ? null : NaN

    // Populate the lagged values each tick:
    for (let step = 1; step <= lookback; step++) {
      const key = keyNames?.[step - 1] ?? `${target}_lag_${step}`
      const laggedIndex = index - step
      const value =
        laggedIndex < 0 || currentColumn[laggedIndex] == null
          ? missingValue
          : currentColumn[laggedIndex]

      main.pushToMain({ index, key, value })

    }
  }

}
