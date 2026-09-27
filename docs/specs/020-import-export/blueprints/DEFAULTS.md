# Import and export blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                      | Default applied                                                                  |
| --- | --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | import-image-pipeline | Order failures are listed in                      | The order of `IMPORT_IMAGE_FAILURES`: file problems, then limits, then transport |
| D2  | import-image-pipeline | Quality of the JPEG fallback                      | `0.85`, the same as WebP                                                         |
| D3  | import-image-pipeline | Whitespace inside a base64 `data:` payload        | Stripped before decoding (hand-edited files wrap lines)                          |
| D4  | import-image-pipeline | How an SVG is recognised without a declared type  | `<svg` within the first 1 KB decoded as UTF-8                                    |
| D5  | import-image-pipeline | Whether a refused offline image spends the budget | It does not; a smaller later image may still fit                                 |
| D6  | import-image-pipeline | A request whose element is absent or not an image | Counted in the report by its outcome; nothing is patched                         |
| D7  | excalidraw-import     | Which tab an import lands in if the user switches | The tab active when the import started                                           |
| D8  | excalidraw-import     | Key for an image element without a `fileId`       | Its element id, so it is processed on its own (and is `missing-bytes`)           |
| D9  | excalidraw-import     | Report view subtitle                              | "Here's how your images came across."                                            |
| D10 | import-image-pipeline | What progress counts                              | Distinct images (keys), not elements: that is the work being waited on           |
