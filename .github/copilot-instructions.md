# Repository guidance

## Build and test

- `npm install` installs the dependencies.
- `npm run build` creates the minified production bundle and source map in `dist/`.
- `npm test` runs the development webpack build with inline source maps; it does not run assertions.
- There is no test runner, individual-test command, or lint script configured. For a browser smoke test, run `python3 -m http.server 8000 --directory tst` and open `http://localhost:8000/index.html`; the other demos are `file.html`, `local_off.html`, and `orbit_shape.html`. These pages load the demo bundle from `tst/js/`.

## Architecture

`show-off.js` is the webpack entry and contains the library. Its public loading functions read OFF text from a URL, a relative path, or a user-selected local file, then construct a `Shape`. `Shape` parses OFF vertices, faces, optional face colors, and two-vertex edge records. `BaseShape` owns the shared WebGL setup, triangulation, shaders, drawing, and mouse/touch/keyboard interaction. `OrbitShape` and `MorphShape` reuse that renderer for transformed copies and changing vertices.

Webpack uses `webpack.common.js` for the entry and `dist/show-off-bundle.js` output; `webpack.config.js` and `webpack.dev.js` select production and development builds. The HTML pages in `tst/` are manual browser demos, with OFF fixtures in `tst/off/`. See `README` for the bundle usage and interaction behavior.

## Conventions

- The library is bundled for browser use: its exports are also assigned to `global` for the demo pages' plain script tags. Keep those public names in sync when changing the API.
- Each canvas owns one active shape; replacing it removes the prior input handlers and GPU buffers.
- Each canvas has a slide-out controls panel for touch access to independent vertex, edge, and face toggles; preserve its canvas ownership and accessible button labels when extending it.
- Shape data uses `Vs` and `Fs` arrays: faces reference vertex indices, and `OrbitShape` transform matrices are supplied as nested row arrays and converted to gl-matrix matrices internally.
- OFF files can include two-index edge records before or after faces. Face colors may use normalized fractional channels or 0–255 integer channels; preserve both input forms when changing parsing. The `v`, `e`, and `f` keys toggle vertices, edges, and faces independently. Faces are shown by default; vertices and edges are hidden. `?vertices=1`, `?edges=1`, and `?faces=0`/`?faces=1` set initial visibility.
- Concave faces use the WebGL stencil-buffer path, drawing each face separately; convex-only models can use the combined triangle buffer. Preserve this distinction when changing triangulation or drawing.
