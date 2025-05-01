/**
 * Automatically resizes an iframe to fit its content height when content changes.
 * @param {HTMLIFrameElement} iframe - The iframe to resize
 *
 * Usage: <iframe src="page.html" onload="resizeMeOnContentChanges(this)"></iframe>
 */
function resizeMeOnContentChanges(iframe) {

    /**
     * Simple debounce utility function.
     * Limits the rate at which a function can fire.
     * @param {Function} func The function to debounce.
     * @param {number} delay The delay in milliseconds.
     * @returns {Function} A new function that only calls the original function
     * after the specified delay has passed without any new calls.
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(context, args);
            }, delay);
        };
    }

    const resizeHandler = function() {
        try {
            if (iframe.contentDocument && iframe.contentDocument.body) {
                initResizer(iframe);
            } else {
                // Handle potential cross-origin or content not ready case
                console.warn('Cannot access iframe content or content not fully ready on load.', iframe.src);
            }
        } catch (error) {
            console.warn('Error accessing iframe content or during initialization', error);
        }
    };

    const initResizer = function(iframe) {
        // Check again in case iframe became inaccessible between load event and init call
         if (!iframe.contentDocument || !iframe.contentDocument.body) {
             console.warn('Iframe contentDocument or body is null during initResizer.');
             return;
         }

        const iframeBody = iframe.contentDocument.body;

        // Define the core resize logic
        const resizeIframe = () => {
            // Temporarily set height to auto to force a recalculation
            iframe.style.height = 'auto';

            // Use a slight delay to allow the browser to recalculate the layout
            // (This setTimeout is necessary for some rendering scenarios)
            setTimeout(() => {
                // Final check before setting height in case iframe was removed or changed
                 if (!iframe.contentDocument || !iframe.contentDocument.body) {
                     return;
                 }
                iframe.style.height = iframeBody.scrollHeight + 'px';
            }, 10); // 10ms is usually sufficient
        };

        // Initial resize on load (use the original, non-debounced function)
        resizeIframe();

        // Create a debounced version of the resize function for the observer
        // Adjust the delay (e.g., 50-100ms) based on how quickly
        // you want the resize to react to bursts of content changes.
        const debouncedResizeIframe = debounce(resizeIframe, 100); // Use a 100ms debounce delay

        // Set up MutationObserver to watch for content changes
        const observer = new MutationObserver(debouncedResizeIframe);

        // Observe the body for changes
        if (iframeBody) {
            observer.observe(iframeBody, {
                childList: true,
                attributes: true,
                subtree: true,
                characterData: true
            });
        }
    }

    iframe.addEventListener('load', resizeHandler);
}