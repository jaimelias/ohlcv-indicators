import { validateInputValues } from '../utilities/validators.js'
import { initializeColumns } from '../core-functions/initializeColumns.js'
import { mathLog } from '../utilities/math.js'

export const donchianChannels = (main, index, size, offset, options) => {
  const { verticalOhlcv, instances, len, inputParams, useFullNames } = main
  const { lag: outputLag = 0, retLogs = false } = options
  const indicatorKey = `${size}_${offset}`
  const instanceKey = `${retLogs ? 'ret_log_' : ''}${indicatorKey}`
  const prefix = `${retLogs ? 'ret_log_' : ''}donchian_channel`

  // ---- INIT (only at first bar) ----
  if (index === 0) {
    validateInputValues({ high: true, low: true }, verticalOhlcv, index, 'donchianChannels')
    if (retLogs) validateInputValues({ close: true }, verticalOhlcv, index, 'donchianChannels')

    const numberOfIndicators = inputParams.filter(o => o.key === 'donchianChannels').length
    const useIndexedKeys = numberOfIndicators > 1 || useFullNames

    const getKey = name =>
      useIndexedKeys
        ? `${prefix}_${name}_${indicatorKey}`
        : `${prefix}_${name}`

    const keys = (retLogs ? ['width', 'position'] : ['upper', 'basis', 'lower']).map(getKey)

    if (!instances.donchian_channel) {
      instances.donchian_channel = { numberOfIndicators, settings: {} }
    }

    instances.donchian_channel.numberOfIndicators = numberOfIndicators
    instances.donchian_channel.settings[instanceKey] = {
      maxDeque: { indices: [], head: 0, length: 0 },
      minDeque: { indices: [], head: 0, length: 0 }
    }

    initializeColumns(main, keys.map(key => ({ key, priceBased: !retLogs })), { lag: outputLag })
  }

  // ---- PER-BAR COMPUTATION ----
  const { numberOfIndicators, settings } = instances.donchian_channel
  const useIndexedKeys = numberOfIndicators > 1 || useFullNames

  const getKey = name =>
    useIndexedKeys
      ? `${prefix}_${name}_${indicatorKey}`
      : `${prefix}_${name}`

  const { maxDeque, minDeque } = settings[instanceKey]
  const current = index - offset
  const start = current - size + 1

  // No source candle is available yet.
  if (current < 0 || current >= len) return

  const { high: highs, low: lows } = verticalOhlcv

  const update = (dq, arr, cmp) => {
    const { indices } = dq
    while (dq.length && indices[dq.head] < start) {
      dq.head = (dq.head + 1) % size
      dq.length--
    }
    while (dq.length && cmp(arr[indices[(dq.head + dq.length - 1) % size]], arr[current])) {
      dq.length--
    }
    // Reuse at most size slots instead of moving entries or growing with the input.
    indices[(dq.head + dq.length) % size] = current
    dq.length++
  }

  update(maxDeque, highs, (a, b) => a <= b)
  update(minDeque, lows, (a, b) => a >= b)

  // Collect warm-up candles, but leave outputs as NaN until the window is complete.
  if (start < 0) return

  const hasBounds = maxDeque.length && minDeque.length
  const upper = hasBounds ? highs[maxDeque.indices[maxDeque.head]] : NaN
  const lower = hasBounds ? lows[minDeque.indices[minDeque.head]] : NaN

  if (retLogs) {
    let width = NaN
    let position = NaN
    const rangeRatio = upper / lower
    if (lower > 0 && upper >= lower && Number.isFinite(upper) && Number.isFinite(rangeRatio)) {
      const logRange = mathLog(rangeRatio, 1)
      width = logRange / 2
      // Offset applies to the channel window, not to the current close.
      const close = verticalOhlcv.close[index]
      const locationRatio = close / lower
      if (logRange > 0 && close > 0 && locationRatio > 0 && Number.isFinite(locationRatio)) {
        const normalized = 2 * mathLog(locationRatio, 1) / logRange - 1
        if (Number.isFinite(normalized)) position = normalized
      }
    }
    main.pushToMain({ index, key: getKey('width'), value: width })
    main.pushToMain({ index, key: getKey('position'), value: position })
    return
  }

  const basis = hasBounds ? (upper + lower) / 2 : NaN

  main.pushToMain({ index, key: getKey('upper'), value: upper })
  main.pushToMain({ index, key: getKey('basis'), value: basis })
  main.pushToMain({ index, key: getKey('lower'), value: lower })

}
