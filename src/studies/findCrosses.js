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

export const crossPairs = (main, index) => {

    const {verticalOhlcv, instances, len, arrayTypes, verticalOhlcvTempCols} = main

    if(index === 0)
    {
        const {inputParams} = main

        instances.crossPairsList = inputParams.reduce((acc, { key, params }) => {
            if (key === 'crossPairs') {
              for (const group of params) {
                for (const pair of group) {
                  acc.push(pair)
                }
              }
            }
            return acc;
          }, [])
    }

    const {crossPairsList} = instances

    for (const { fast, slow } of crossPairsList)
    {
        if (fast == null || slow == null) continue;

        let crossName = `${fast}_x_${slow}`

        if(index === 0)
        {
            if(typeof slow === 'number')
            {
                verticalOhlcvTempCols.add(slow.toString())
                verticalOhlcv[slow.toString()] = new Int32Array(len).fill(slow)
            }
            
            if(fast !== 'price' && !verticalOhlcv.hasOwnProperty(fast)) throw Error(`fast "${fast} not found in crossPairs"`)
            if(!verticalOhlcv.hasOwnProperty(slow)) throw Error(`slow "${slow} not found in crossPairs"`)


            instances[crossName] = new CrossInstance()

            verticalOhlcv[crossName] = new Int32Array(len).fill(NaN)

            arrayTypes[crossName] = 'Int32Array'
        }

        let fastValue
        let closeValue
        let highValue
        let lowValue
        let slowValue

        if(fast === 'price')
        {
            closeValue = verticalOhlcv.close[index]
            highValue = verticalOhlcv.high[index]
            lowValue = verticalOhlcv.low[index]
            slowValue = verticalOhlcv[slow][index]

            instances[crossName].update(index, {fast: closeValue, slow: slowValue, high: highValue, low: lowValue})

        } else
        {
            fastValue = verticalOhlcv[fast][index]
            slowValue = verticalOhlcv[slow][index]

            instances[crossName].update(index, {fast: fastValue, slow: slowValue})
        }

        main.pushToMain({index, key: crossName, value: instances[crossName].getResult()})
    }

}