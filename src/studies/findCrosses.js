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

export const crossPairs = (main, index, crossPairsList, {limit}) => {
  const {verticalOhlcv, verticalOhlcvTempCols, instances, len, arrayTypes, notNumberKeys} = main

  if(index === 0)
  {
    for (const { fast, slow } of crossPairsList)
    {
        const crossName = `${fast}_x_${slow}`

        // allow numeric 'slow' as a constant column

        if (typeof slow === 'number') {

            const col = slow.toString()
            verticalOhlcvTempCols.add(col)
            notNumberKeys.add(col)
            verticalOhlcv[col] =  new Int16Array(len).fill(slow)
            arrayTypes[col] = 'Int16Array'
        }

        // sanity checks
        if (fast !== "price" && !verticalOhlcv.hasOwnProperty(fast)) {
            throw new Error(`fast "${fast}" not found in crossPairs "${crossName}"`)
        }
        if (!verticalOhlcv.hasOwnProperty(slow)) {
            throw new Error(`slow "${slow}" not found in crossPairs "${crossName}"`)
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
        
        verticalOhlcv[crossName] = new Int32Array(len).fill(NaN)
        notNumberKeys.add(crossName)
        arrayTypes[crossName] = 'Int32Array'

    }
  }

 

  for (const { fast, slow } of crossPairsList) {

    const crossName = `${fast}_x_${slow}`

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

    const value = limit === null ? rawValue : Math.max(-limit, Math.min(limit, rawValue))

    main.pushToMain({index, key: crossName, value})

  }

  return true
}