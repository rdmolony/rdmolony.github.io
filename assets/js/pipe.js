/**
 * Functional utility that applies a series of functions to a value
 * @param {*} initialValue - The starting value to pass through the functions
 * @param {...Function} fns - One or more functions to apply sequentially
 * @returns {*} The initial value after all functions have been applied
 * 
 * Example: pipe(iframeElement, resizeMeOnContentChanges, inheritBackgroundColor)
 */
function pipe(initialValue, ...fns) {
    // Apply each function to the initial value, not using the return value
    fns.forEach(fn => fn(initialValue));
    return initialValue;
}