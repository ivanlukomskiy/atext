// src/opencv.ts

declare global {
    interface Window {
        cv: any;
    }
}

export function loadOpenCV(onloadCallback: () => void): void {
    const script = document.createElement('script');
    script.setAttribute('async', '');
    script.setAttribute('type', 'text/javascript');
    script.addEventListener('load', () => {
        if (window.cv) {
            onloadCallback();
        } else {
            // if window.cv is not present, wait for it
            const timeout = 10;
            let attempts = 0;
            const waitForCV = () => {
                attempts++;
                if (window.cv) {
                    onloadCallback();
                } else if (attempts > 100) {
                    console.error('Failed to load OpenCV.js');
                } else {
                    setTimeout(waitForCV, timeout);
                }
            };
            waitForCV();
        }
    });
    script.src = 'https://docs.opencv.org/4.5.2/opencv.js';
    const node = document.getElementsByTagName('script')[0];
    if (node && node.parentNode) {
        node.parentNode.insertBefore(script, node);
    } else {
        document.head.appendChild(script);
    }
}