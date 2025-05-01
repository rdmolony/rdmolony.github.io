/**
 * Inherits parent page background color for an iframe
 * @param {HTMLIFrameElement} iframe - The iframe to style
 */
function inheritBackgroundColor(iframe) {
    // Define the handler function
    const styleHandler = function() {
        try {
            // Try to access contentDocument - this will throw an error if cross-origin
            if (iframe.contentDocument && iframe.contentDocument.body) {
                const parentBgColor = getComputedStyle(document.body).backgroundColor;
                iframe.contentDocument.body.style.backgroundColor = parentBgColor;
            }
        } catch (error) {
            console.warn('Cannot access iframe content - likely due to cross-origin restrictions', error);
        }
    };

    // If already loaded, apply immediately
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        styleHandler();
    }
    
    // Add the load event listener
    iframe.addEventListener('load', styleHandler);
}