# Import and export blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint             | Spec silence                                        | Default applied                                                                                                   |
| --- | --------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| D1  | import-image-pipeline | Order of the failure names                          | The order of `ImportImageFailure`: file problems, then limits, then transport                                     |
| D2  | import-image-pipeline | Quality of the JPEG fallback                        | `0.85`, the same as WebP                                                                                          |
| D3  | import-image-pipeline | Whitespace inside a base64 `data:` payload          | Stripped before decoding (hand-edited files wrap lines)                                                           |
| D4  | import-image-pipeline | How an SVG is recognised without a declared type    | `<svg` within the first 1 KB decoded as UTF-8                                                                     |
| D5  | import-image-pipeline | Whether a refused offline image spends the budget   | It does not; a smaller later image may still fit                                                                  |
| D11 | import-image-pipeline | How long WebP support is known                      | For the page: the first canvas answer decides; `null` answers decide nothing                                      |
| D12 | import-image-pipeline | Whether a failed WASM load is remembered            | It is not; the next image tries again (a flaky network should not cost the import)                                |
| D13 | import-image-pipeline | How to prove the Safari path where WebKit has WebP  | The test makes the canvas answer WebP with PNG, which is what Safari does                                         |
| D46 | animated-gif-export   | What happens to consecutive identical frames' bytes | The encoder holds the last frame and adds a repeat's delay to it, so a still stretch is one frame                 |
| D47 | animated-gif-export   | When the estimate is worked out                     | 250 ms after the options last changed, from one encoded frame of the preview page at the chosen size              |
| D48 | animated-gif-export   | How the estimate counts                             | Sample bytes x frames in the timeline + 800 bytes of header; MB is 1,000,000 bytes, one decimal; under 1 MB in KB |
| D49 | animated-gif-export   | An image that cannot be read into the GIF           | A transparent pixel in its place; the export goes on                                                              |
| D50 | animated-gif-export   | A transition longer than half the hold              | Shortened to half the hold, so every page is seen still                                                           |
| D51 | animated-gif-export   | The easing of the GIF's transitions                 | The presenting transitions' own: cubic-bezier(0.4, 0, 0.2, 1) for Slide, ease for Fade                            |
| D52 | animated-gif-export   | When the main thread yields during a make           | After every frame, so the editor stays responsive                                                                 |
| D53 | animated-gif-export   | Which frames a page's shared palette is chosen from | Its first, middle and last frames outside a transition, every 4th pixel of each                                   |
| D60 | office-import | How much compressed input the inflater takes at a time | 16 KB, so one write can unpack at most ~16.5 MB (deflate's 1032:1) before the count is checked |
| D61 | office-import | How long a slide's imported notes may be | 20,000 characters, an article block's own cap |
| D62 | office-import | ZIP64 packages | Refused as not a package: a file under the 50 MB cap never needs ZIP64 |
| D63 | office-import | A list level the numbering part does not define | Bulleted |
| D64 | office-import | Which fonts make a run code | Any font named with "mono", or Courier, Courier New, Consolas, Monaco, Menlo, Lucida Console, Inconsolata, Source Code Pro, Fira Code, Andale Mono, Cascadia Code |
| D65 | office-import | A slide shape with no box on the slide, its layout or its master | Left out, uncounted (PowerPoint draws it nowhere either) |
| D66 | office-import | Where an imported article's zones stand before the editor lays the writing out | Parked in non-overlapping slots left of the first page, each image exactly in its zone; the first layout settles them |
| D67 | office-import | A deck with no slides | One empty slide page, as an empty document is one empty paragraph |
| D68 | office-import | The Import dialog closed while an import is still running | The import finishes and replaces the tab; Undo still brings the old content back |
