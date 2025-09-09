# Simple HTML/CSS/JavaScript Blank Project

This is a minimal starter with organized folders:
- index.html
- style/styles.css
- js/script.js

How to use:
1. Open index.html in your browser (double-click it or drag it into a browser window).
2. You should see a simple page with a button. Click the button to confirm JavaScript is working.

Notes:
- The root index.html links to CSS and JS using: style/styles.css and js/script.js
- You can add more pages to the pages/ folder; those pages should link using ../style/styles.css and ../js/script.js.

Tailwind CSS:
- Tailwind is included via the official CDN for a zero-build setup.
- All Tailwind classes are prefixed with `tw-` to avoid conflicts with existing styles (e.g., use `tw-text-cyan-400` instead of `text-cyan-400`).
- Example usage: `<h1 class="tw-text-cyan-400 tw-font-semibold">Hello</h1>`
- If you later need a production build setup (purging unused styles, custom plugins), migrate to the Tailwind CLI/PostCSS workflow.