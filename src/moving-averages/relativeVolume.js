import {FasterSMA} from 'trading-signals'

export const relativeVolume = (main, size) => {
    const {verticalOhlcv} = main
    const {volume} = verticalOhlcv
    const col = getRelativeVolume(volume, size)

    return {
        [`relative_volume_${size}`]: col
    }
}

export const getRelativeVolume = (volume, size = 10) => {
    
    const instance = new FasterSMA(size)
    const sma = new Array(volume.length).fill(null)
    const output = new Array(volume.length).fill(null)

    for(let x = 0; x < volume.length; x++)
    {
        let value = null

        instance.update(volume[x])

        try
        {
          value = instance.getResult()
        }
        catch(err)
        {
          value = null
        }

        sma[x] = value

        if(typeof sma[x-1] === 'number')
        {
            output[x] = volume[x] / sma[x-1]
        }
    }

    console.log(output)

    return output
}
