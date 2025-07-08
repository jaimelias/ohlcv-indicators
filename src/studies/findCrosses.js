import { oneHotEncode } from "../machine-learning/ml-utilities.js"
import { buildArray } from "../utilities/assignTypes.js"
const eq = (fast, slow) => fast === slow
const gt = (fast, slow) => fast > slow
const lt = (fast, slow) => fast < slow


//this class counts how many intervals have passed between crosses: fast crossed slow line, high crossed slow line or low crossed slow line.
//interval === 0 for no crosses yet or the lines are equal
//interval >= 1 for an upwards crosses
//interval <= -1 from downward crosses

class CrossInstance {

    constructor()
    {
        Object.assign(this, {
            interval: 0,
            prevState: 0.5,
            prevFast: NaN,
            prevSlow: NaN,
            prevHigh: NaN,
            prevLow: NaN,
            areHighAndLowUndefined: false,
            crossIndexes: {
                up: [],
                down: []
            }
        })        

    }
    update(index, {fast, high, slow, low})
    {
        let currState = this.prevState

        if(!this.areHighAndLowUndefined)
        {
            if(typeof high === 'undefined' || typeof low === 'undefined')
            {
                this.areHighAndLowUndefined = true
            }
        }

        if(Number.isNaN(fast) || Number.isNaN(slow)){
            currState = 0.5
        }
        else if(eq(fast, slow)) {
            currState = 0.5
        }
        else if(gt(fast, slow)) {

            if(this.areHighAndLowUndefined)
            {
                currState = 1
            }
            else
            {
                if ([low, slow, this.prevLow, this.prevSlow].every(v => !Number.isNaN(v)) && lt(low, slow) && gt(this.prevLow, this.prevSlow))
                {
                    currState = 0
                }
                else
                {
                    currState = 1
                }
            }
        }
        else if(lt(fast, slow)) {

            if(this.areHighAndLowUndefined)
            {
                currState = 0
            }
            else
            {
                if([high, slow, this.prevHigh, this.prevSlow].every(v => !Number.isNaN(v)) && gt(high, slow) && lt(this.prevHigh, this.prevSlow))
                {
                    currState = 1
                }
                else
                {
                    currState = 0
                }
            }
        }

        if(currState === 0.5)
        {
            this.interval = 0
        }
        else if(currState === 1)
        {
            if(this.prevState <= 0.5)
            {
                this.interval = 1
            }
            else
            {
                this.interval++
            }
        }
        else if(currState === 0)
        {
            if(this.prevState >= 0.5)
            {
                this.interval = -1
            }
            else
            {
                this.interval--
            }
        }


        if(this.interval === 1) this.crossIndexes.up.push(index)
        if(this.interval === -1) this.crossIndexes.down.push(index)

        //save prev state
        Object.assign(this, {
            prevState: currState,
            prevFast: fast,
            prevSlow: slow,
            prevHigh: high,
            prevLow: low
        })        
    }

    getResult()
    {
        return this.interval
    }

}

export const crossPairs = (main, index, crossPairsList, {limit, oneHot}) => {

  const {verticalOhlcv, verticalOhlcvTempCols, instances, len} = main

  for (const { fast, slow } of crossPairsList) {

    const crossName = `${fast}_x_${slow}`

    if(index === 0)
    {
        // allow numeric 'slow' as a constant column
        if (typeof slow === 'number') {

            const col = slow.toString()
            verticalOhlcvTempCols.add(col)
            verticalOhlcv[col] =  buildArray('Int16Array', len)
        }

        if(!instances.hasOwnProperty('crossPairs'))
        {
            instances.crossPairs = {}
        }

        // create instance + output buffer
        instances.crossPairs[crossName] = {
            run: new CrossInstance(),
            min: Infinity,
            max: -Infinity
        }

        let crossArrType = 'Int16Array'

        if(limit <= 125)
        {
            crossArrType = 'Int8Array'
        }

        verticalOhlcv[crossName] = buildArray(crossArrType, len)
        
        if(oneHot)
        {
            verticalOhlcv[`one_hot_${crossName}`] = buildArray('Array', len)
        }

    }  else if(index + 1 === len) {
        // sanity checks
        if (fast !== "price" && !verticalOhlcv.hasOwnProperty(fast)) {
            throw new Error(`crossPairs invalid param: fast "${fast}" not found in "verticalOhlcv": ${JSON.stringify(Object.keys(verticalOhlcv))}`)
        }
        if (!verticalOhlcv.hasOwnProperty(slow)) {
            throw new Error(`crossPairs invalid param: slow "${slow}" not found in "verticalOhlcv": ${JSON.stringify(Object.keys(verticalOhlcv))}`)
        }
    }
    
    if (fast !== "price" && !verticalOhlcv.hasOwnProperty(fast)) return
    if (!verticalOhlcv.hasOwnProperty(slow)) return

    const {run} = instances.crossPairs[crossName]

    // ——— Per-bar update ———
    if (fast === 'price') {
      const fastVal = verticalOhlcv.close[index]
      const slowVal = verticalOhlcv[slow][index]
      run.update(index, {
        fast: fastVal,
        slow: slowVal,
        high: verticalOhlcv.high[index],
        low: verticalOhlcv.low[index],
      });
    } else {
      const fastVal = verticalOhlcv[fast][index]
      const slowVal = verticalOhlcv[slow][index]
      run.update(index, { fast: fastVal, slow: slowVal })
    }

    const rawValue = run.getResult()

    const value = rawValue//Math.max(-limit, Math.min(limit, rawValue))

    main.pushToMain({index, key: crossName, value})

    if(oneHot)
    {
        // clamp _just_ for the one-hot index
        const clamped = Math.max(-limit, Math.min(limit, rawValue));
        const oneHotIdx = clamped + limit;
        const oneHotSize = 2 * limit + 1;
        main.pushToMain({
            index,
            key: `one_hot_${crossName}`,
            value: oneHotEncode(oneHotIdx, oneHotSize)
        });
    }

  }

  return true
}