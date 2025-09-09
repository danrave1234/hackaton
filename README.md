## Hackaton Game

A browser-based JavaScript game that runs directly from `index.html` with no build steps.

### Run the project (via index.html)
- **Option 1 (double-click/open):**
  1. Locate `index.html` in the project root.
  2. Double-click it (or right-click → Open With → your browser).

- **Option 2 (drag-and-drop):**
  1. Open your browser.
  2. Drag `index.html` into the browser window.

- **Optional: serve locally (avoids any file:// restrictions):**
  - Python 3: `python -m http.server 5500` then open `http://localhost:5500/index.html`

### Project structure
- `index.html`: Main entry point
- `style/styles.css`: Global styles
- `js/`: Game engine, systems, and scripts
  - `engine/`: Core loop and events
  - `entities/`: Game entities (e.g., `factory.js`)
  - `systems/`: Rendering, movement, AI, collisions, etc.
  - `game.js`, `script.js`: Game initialization and glue code
- `asset/`: Images, spritesheets, audio, and 3D models
- `pages/`: Additional pages (`game.html`, `leaderboard.html`, examples)

### Notes
- No build tools are required; assets are loaded via relative paths from `index.html`.
- If a browser blocks some asset loads using `file://`, use the optional local server method above.