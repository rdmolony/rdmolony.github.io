/**
 * Automatically resizes an iframe to fit its content height when content changes.
 * @param {HTMLIFrameElement} iframe - The iframe to resize
 * 
 * Usage: <iframe src="page.html" onload="resizeMeOnContentChanges(this)"></iframe>
 */
function resizeMeOnContentChanges(iframe) {

    const debounce = (callback, wait) => {
        let timeoutId = null;
        return (...args) => {
          window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(() => {
            callback(...args);
          }, wait);
        };
    };

    const initResizer = function(iframe) {
        const iframeBody = iframe.contentDocument.body;

        // Track stability with timestamps
        let lastMutationTime = Date.now();
        let stabilityTimer = null;
        const STABILITY_THRESHOLD = 1000; // Consider content stable after 1 second of no changes

        const resizeIframe = () => {
            // Store current scroll position before resizing
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            
            // Temporarily set height to auto to force a recalculation
            iframe.style.height = 'auto';

            // Use a slight delay to allow the browser to recalculate the layout
            setTimeout(() => {
                iframe.style.height = iframeBody.scrollHeight + 'px';
                
                // Restore scroll position
                window.scrollTo(0, scrollTop);
            }, 10);
        };

        // Function to set up the actual resize observer once content is stable
        const setupResizeObserver = () => {
            // Do one final resize before setting up the observer
            resizeIframe();
            
            // Set up MutationObserver to watch for content changes and resize accordingly
            const resizeObserver = new MutationObserver(debounce(ev => resizeIframe(ev), 250));

            // Observe the body for changes
            if (iframeBody) {
                resizeObserver.observe(iframeBody, {
                    childList: true,
                    attributes: true,
                    subtree: true,
                    characterData: true
                });
            }
        };

        // Create a temporary observer to detect when content stabilizes
        const stabilityObserver = new MutationObserver(() => {
            lastMutationTime = Date.now();
            
            // Clear any existing timer
            if (stabilityTimer) {
                clearTimeout(stabilityTimer);
            }
            
            // Set a new timer to check if content has stabilized
            stabilityTimer = setTimeout(() => {
                // If we've reached this point, no mutations have occurred for STABILITY_THRESHOLD ms
                // Content is considered stable, so we can set up the resize observer
                setupResizeObserver();
                
                // Disconnect the stability observer as it's no longer needed
                stabilityObserver.disconnect();
            }, STABILITY_THRESHOLD);
        });

        // Initial resize on load
        resizeIframe();

        // Start observing for stability
        if (iframeBody) {
            stabilityObserver.observe(iframeBody, {
                childList: true,
                attributes: true,
                subtree: true,
                characterData: true
            });
        }
    }

    const resizeHandler = function() {
        try {
            if (iframe.contentDocument && iframe.contentDocument.body) {
                initResizer(iframe);
            }
        } catch (error) {
            console.warn('Cannot access iframe content - likely due to cross-origin restrictions', error);
        }
    };

    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        resizeHandler();
    }
    iframe.addEventListener('load', resizeHandler);
  
  }
