# Import and export blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                                            | Default applied                                                                                 |
| --- | --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D1  | import-image-pipeline | Order failures are listed in                                            | The order of `IMPORT_IMAGE_FAILURES`: file problems, then limits, then transport                |
| D2  | import-image-pipeline | Quality of the JPEG fallback                                            | `0.85`, the same as WebP                                                                        |
| D3  | import-image-pipeline | Whitespace inside a base64 `data:` payload                              | Stripped before decoding (hand-edited files wrap lines)                                         |
| D4  | import-image-pipeline | How an SVG is recognised without a declared type                        | `<svg` within the first 1 KB decoded as UTF-8                                                   |
| D5  | import-image-pipeline | Whether a refused offline image spends the budget                       | It does not; a smaller later image may still fit                                                |
| D6  | import-image-pipeline | A request whose element is absent or not an image                       | Counted in the report by its outcome; nothing is patched                                        |
| D7  | excalidraw-import     | Which tab an import lands in if the user switches                       | The tab active when the import started                                                          |
| D8  | excalidraw-import     | Key for an image element without a `fileId`                             | Its element id, so it is processed on its own (and is `missing-bytes`)                          |
| D9  | excalidraw-import     | Report view subtitle                                                    | "Here's how your images came across."                                                           |
| D10 | import-image-pipeline | What progress counts                                                    | Distinct images (keys), not elements: that is the work being waited on                          |
| D11 | import-image-pipeline | How long WebP support is known                                          | For the page: the first canvas answer decides; `null` answers decide nothing                    |
| D12 | import-image-pipeline | Whether a failed WASM load is remembered                                | It is not; the next image tries again (a flaky network should not cost the import)              |
| D13 | import-image-pipeline | How to prove the Safari path where WebKit has WebP                      | The test makes the canvas answer WebP with PNG, which is what Safari does                       |
| B1  | board-scene           | How "nearest" marker width and text size are measured                   | By ratio (log distance), ties to the larger: a 2 px line is between 1.5 and 2.5, not nearer 1.5 |
| B2  | board-scene           | Which stock colour wins a hue tie                                       | The earlier in `PEN_COLOURS` order                                                              |
| B3  | board-scene           | Which head an arrow with two different heads keeps                      | The end head: the direction the arrow reads                                                     |
| B4  | board-scene           | Handles of a curved polyline's nodes                                    | Catmull-Rom, a sixth of the neighbours' chord, mirrored                                         |
| B5  | board-scene           | What a stock colour becomes on a kind with no named field (highlighter) | Its light-board version's hex                                                                   |
| B6  | board-scene           | Default title of a landed whiteboard tab                                | "Whiteboard", the template's title                                                              |
| B7  | board-scene           | How long the paste notice stays                                         | Until closed, replaced by the next paste, or the tab changes (no timer: WCAG 2.2.1)             |
| B8  | board-scene           | Serif source fonts                                                      | Lora, the catalogue's serif                                                                     |
| B9  | board-scene           | A paste whose tab is left while its images upload                       | It does not land: it belonged to the tab it was made on                                         |
| B10 | board-scene           | Text colour on a fill that does not adapt                               | Its exact hex, never ink or a stock name (a black label stays black on its pale fill)           |
| B11 | board-scene           | A stroke longer than an element holds                                   | Sampled evenly along its points, both ends kept, and reported                                   |
