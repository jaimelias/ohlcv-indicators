export const oneHotEncode = (idx, size) => {
    const vec = new Uint8Array(size)
    vec[idx] = 1
    return vec
}

export const findGroupsFunc = (findGroups, scaledGroups) => {

    const output = []

    if(findGroups.length > 0)
    {
        for(let g = 0; g < findGroups.length; g++)
        {
            const group = findGroups[g]
            if(!scaledGroups.hasOwnProperty(`${group.type}_${group.size}`)) throw new Error(`Scaled group not found for ${type} regressor.options.findGroups[${g}]: ${JSON.stringify(group)}`)
            output.push(...scaledGroups[`${group.type}_${group.size}`])
        }
    }

    return output
}