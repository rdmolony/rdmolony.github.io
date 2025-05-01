/**
 * Functional utility that applies a series of functions to an element
 * @param {HTMLElement} element - The starting element to pass through the functions
 * @param {...Function} fns - One or more functions to apply to the same element
 * 
 * Example: applyFunctions(element, resizeMeOnContentChanges, inheritBackgroundColor)
 */
function applyFunctions(element, ...fns) {
    fns.forEach(fn => fn(element));
}