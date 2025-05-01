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

    const resizeHandler = function() {
        try {
            if (iframe.contentDocument && iframe.contentDocument.body) {
                initResizer(iframe);
            }
        } catch (error) {
            console.warn('Cannot access iframe content - likely due to cross-origin restrictions', error);
        }
    };

    const initResizer = function(iframe) {
        const iframeBody = iframe.contentDocument.body;

        const resizeIframe = () => {
            // Temporarily set height to auto to force a recalculation
            iframe.style.height = 'auto';

            // Use a slight delay to allow the browser to recalculate the layout
            setTimeout(() => {
                iframe.style.height = iframeBody.scrollHeight + 'px';
            }, 10);
        };

        // Initial resize on load
        resizeIframe();

        // Set up MutationObserver to watch for content changes
        const observer = new MutationObserver(debounce (ev => resizeIframe(ev), 250));

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
      
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      resizeHandler();
    }
    iframe.addEventListener('load', resizeHandler);
  
  }
