import { calcMagnitude } from "../utilities/numberUtilities.js"


export const donchianChannels = (main, index, size, offset, { height, range, scale}) => {

  const indicatorKey = `${size}_${offset}`
  const {verticalOhlcv, instances, len} = main

  // Initialization: create output arrays and indicator instance on the first call.
  if (index === 0) {
    const {inputParams, nullArray, priceBased} = main
    const numberOfIndicators = inputParams.filter(o => o.key === 'donchianChannels').length
    const prefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel'

    Object.assign(verticalOhlcv, {
      [`${prefix}_upper`]: [...nullArray],
      [`${prefix}_basis`]: [...nullArray],
      [`${prefix}_lower`]: [...nullArray],
      ...(height && { [`${prefix}_height`]: [...nullArray] })
    })

    priceBased.push(`${prefix}_upper`, `${prefix}_basis`, `${prefix}_lower`);

    if (!instances.hasOwnProperty('donchian_channel')) {
      instances.donchian_channel = { numberOfIndicators, settings: {} }
    }

    // Set up additional arrays for each range property.
    for (const rangeKey of range) {
      if (!(rangeKey in verticalOhlcv) || !priceBased.includes(rangeKey)) {
        throw new Error(`Invalid range item value "${rangeKey}" property for donchianChannels. Only price based key names are accepted:\n${JSON.stringify(priceBased)}`)
      }
      verticalOhlcv[`${prefix}_range_${rangeKey}`] = [...nullArray]
    }

    instances.donchian_channel.settings[indicatorKey] = {
      maxDeque: [], // will hold indices for highs in descending order
      minDeque: []  // will hold indices for lows in ascending order
    }
  }

  const numberOfIndicators = instances.donchian_channel.numberOfIndicators
  const subPrefix = numberOfIndicators > 1 ? `donchian_channel_${indicatorKey}` : 'donchian_channel'
  const state = instances.donchian_channel.settings[indicatorKey]
  const { maxDeque, minDeque } = state

  // Compute the “current bar index” for the window.
  // Note: We use index - offset so that the window is built on the proper part of the array.
  const currentBarIdx = index - offset
  const endIdx = currentBarIdx + 1    // currentBarIdx is inclusive
  const startIdx = endIdx - size        // window: [startIdx, endIdx)

  // If the window is not fully available, exit early.
  if (startIdx < 0 || endIdx > len) return true

  const highs = verticalOhlcv.high
  const lows = verticalOhlcv.low

  // **Update the maximum deque:**
  // Remove indices that are out of the current window.
  while (maxDeque.length && maxDeque[0] < startIdx) {
    maxDeque.shift()
  }
  // Remove indices whose corresponding high value is less than or equal to the current high.
  while (maxDeque.length && highs[maxDeque[maxDeque.length - 1]] <= highs[currentBarIdx]) {
    maxDeque.pop()
  }
  // Add the current index.
  maxDeque.push(currentBarIdx)

  // **Update the minimum deque:**
  // Remove indices that are out of the current window.
  while (minDeque.length && minDeque[0] < startIdx) {
    minDeque.shift()
  }
  // Remove indices whose corresponding low value is greater than or equal to the current low.
  while (minDeque.length && lows[minDeque[minDeque.length - 1]] >= lows[currentBarIdx]) {
    minDeque.pop()
  }
  // Add the current index.
  minDeque.push(currentBarIdx)

  // Now the maximum high is at the front of maxDeque and the minimum low is at the front of minDeque.
  const upper = highs[maxDeque[0]]
  const lower = lows[minDeque[0]]
  const basis = (upper + lower) / 2
  
  // Update the computed values in the output arrays.

  main.pushToMain({index, key: `${subPrefix}_upper`, value: upper})
  main.pushToMain({index, key: `${subPrefix}_basis`, value: basis})
  main.pushToMain({index, key: `${subPrefix}_lower`, value: lower})

  if (height) {
    let heightValue = ((upper - lower) / lower)

    if(scale)
    {
      heightValue = calcMagnitude(heightValue, scale)
    }

    main.pushToMain({index, key: `${subPrefix}_height`, value: heightValue})
  }

  // Process each range property.
  for (const rangeKey of range) {
    let rangeValue = (verticalOhlcv[rangeKey][index] - lower) / (upper - lower)

    if(scale)
    {
      rangeValue = calcMagnitude(rangeValue, scale)
    }

    main.pushToMain({index, key: `${subPrefix}_range_${rangeKey}`, value: rangeValue})
  }

  return true
}
