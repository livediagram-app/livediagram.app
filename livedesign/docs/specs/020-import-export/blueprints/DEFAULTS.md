# Import and export blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                         | Default applied                                                                     |
| --- | --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | import-image-pipeline | Order failures are listed in                         | The order of `IMPORT_IMAGE_FAILURES`: file problems, then limits, then transport    |
| D2  | import-image-pipeline | Quality of the JPEG fallback                         | `0.85`, the same as WebP                                                            |
| D3  | import-image-pipeline | Whitespace inside a base64 `data:` payload           | Stripped before decoding (hand-edited files wrap lines)                             |
| D4  | import-image-pipeline | How an SVG is recognised without a declared type     | `<svg` within the first 1 KB decoded as UTF-8                                       |
| D5  | import-image-pipeline | Whether a refused offline image spends the budget    | It does not; a smaller later image may still fit                                    |
| D6  | import-image-pipeline | A request whose element is absent or not an image    | Counted in the report by its outcome; nothing is patched                            |
| D10 | import-image-pipeline | What progress counts                                 | Distinct images (keys), not elements: that is the work being waited on              |
| D11 | import-image-pipeline | How long WebP support is known                       | For the page: the first canvas answer decides; `null` answers decide nothing        |
| D12 | import-image-pipeline | Whether a failed WASM load is remembered             | It is not; the next image tries again (a flaky network should not cost the import)  |
| D13 | import-image-pipeline | How to prove the Safari path where WebKit has WebP   | The test makes the canvas answer WebP with PNG, which is what Safari does           |
| D14 | svg-import            | How arc precision meets a landed size not yet known  | Guess from the viewBox; walk again at the fit scale when it passes the guess by 1.5 |
| D15 | svg-import            | Markup without the SVG namespace (pasted inline SVG) | Read as SVG: elements with no namespace count, other namespaces are skipped         |
| D16 | svg-import            | `preserveAspectRatio` on a nested `<svg>`            | The default, `xMidYMid meet`; the root's is moot (the import is fitted)             |
| D17 | svg-import            | A nonzero element too detailed to check              | Left even-odd, past 50,000 traced points (Combine's own input cap)                  |
| D18 | svg-import            | How densely nonzero is checked                       | 24 points each side of each contour, spread by length, offset 0.05 px               |
| D19 | svg-import            | Fill and stroke opacity on one path                  | The fill's alpha when filled, else the stroke's, times the element's opacity        |
| D20 | svg-import            | Where a picture fallback lands                       | The drop point, else the middle of the landing page's safe area                     |
| D21 | svg-import            | SVG 2 joins on an outlined stroke                    | `miter-clip` and `arcs` drawn as `miter`                                            |
| D22 | svg-import            | When a stroke "passes" 7 px                          | Landed wider than 7 px by more than a thousandth, so rounding never outlines        |
