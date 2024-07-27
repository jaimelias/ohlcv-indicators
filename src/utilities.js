export const findCrosses = (BigNumber, fast, slow) => {
    const states = fast.map((f, i) => {
        if (f.isGreaterThan(slow[i])) {
            return 'up';
        } else if (f.isLessThan(slow[i])) {
            return 'down';
        } else {
            return 'neutral';
        }
    });

    const crosses = [];
    let currentCrossValue = 0;
    let lastState = 'neutral';

    for (let i = 0; i < states.length; i++) {
        if (states[i] === 'up') {
            if (lastState === 'down' || lastState === 'neutral') {
                currentCrossValue = 1;
            } else {
                currentCrossValue += 1;
            }
        } else if (states[i] === 'down') {
            if (lastState === 'up' || lastState === 'neutral') {
                currentCrossValue = -1;
            } else {
                currentCrossValue -= 1;
            }
        } else {
            currentCrossValue = 0;
        }
        crosses.push(currentCrossValue);
        lastState = states[i];
    }

    return crosses;
};
