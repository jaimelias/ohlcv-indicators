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

export const crossPairs = (main, index, crossPairsList) => {
  const {verticalOhlcv, verticalOhlcvTempCols, instances, len, arrayTypes} = main

  if(index === 0)
  {
    for (const { fast, slow } of crossPairsList)
    {
        const crossName = `${fast}_x_${slow}`

        // allow numeric 'slow' as a constant column
        if (typeof slow === "number") {
            const col = slow.toString()
            verticalOhlcvTempCols.add(col)
            verticalOhlcv[col] = new Int32Array(len).fill(slow)
        }

        // sanity checks
        if (fast !== "price" && !verticalOhlcv.hasOwnProperty(fast)) {
            throw new Error(`fast "${fast}" not found in crossPairs`)
        }
        if (!verticalOhlcv.hasOwnProperty(slow)) {
            throw new Error(`slow "${slow}" not found in crossPairs`)
        }

        // create instance + output buffer
        instances[crossName] = new CrossInstance()
        verticalOhlcv[crossName] = new Int32Array(len).fill(NaN)
        arrayTypes[crossName] = "Int32Array"

    }
  }

  for (const { fast, slow } of crossPairsList) {

    const crossName = `${fast}_x_${slow}`

    // ——— Per-bar update ———
    if (fast === "price") {
      const fastVal = verticalOhlcv.close[index]
      const slowVal = verticalOhlcv[slow][index]
      instances[crossName].update(index, {
        fast: fastVal,
        slow: slowVal,
        high: verticalOhlcv.high[index],
        low: verticalOhlcv.low[index],
      });
    } else {
      const fastVal = verticalOhlcv[fast][index]
      const slowVal = verticalOhlcv[slow][index]
      instances[crossName].update(index, { fast: fastVal, slow: slowVal })
    }

    // push the result
    main.pushToMain({
      index,
      key: crossName,
      value: instances[crossName].getResult(),
    })
  }

  return true
};
