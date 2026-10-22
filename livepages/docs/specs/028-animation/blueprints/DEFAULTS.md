# Animation blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #    | Blueprint          | Spec silence                                                | Default applied                                                                                                                               |
| ---- | ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| EA1  | element-animations | The letter and word limits                                  | 400 graphemes for letters, 120 words for words, else one block                                                                                |
| EA2  | element-animations | How long a reveal holds before clearing                     | Reveal over the first 45% of the cycle, hold to 85%, clear by 100%                                                                            |
| EA3  | element-animations | Which shapes count as carrying words                        | `takesTypedLabel`, not `selfLabelled`, and not icon, chair or sticker                                                                         |
| EA4  | element-animations | Which set annotations, link cards, stickers and chairs take | Shape                                                                                                                                         |
| EA5  | element-animations | How a table's words are counted against the limits          | Summed across every cell in reading order, as one label                                                                                       |
| EA6  | element-animations | How auto-fit (SVG) labels animate their letters             | Keep the SVG `<text>` to measure the fit, painted transparent, and draw the animated words as HTML in a `foreignObject` over the measured box |
| EA7  | element-animations | Which values a kept tile can show                           | Only values of the Shape set (the only set that existed before the split)                                                                     |
| EA8  | element-animations | How many letters flicker                                    | 12% of letters, at least one, chosen from the element id                                                                                      |
| EA9  | element-animations | Boil frame rate                                             | 8 frames a second, three frames                                                                                                               |
| EA10 | element-animations | Fixed time for a long table cascade                         | The reveal phase of the cycle (45% of `D`); the stagger divides it by the unit count                                                          |

| EA11 | element-animations | The accent of words without a stroke colour | Brand sky; marker yellow for Highlighter |
| EA12 | element-animations | The accent of a body animation when the element sets no stroke | Its theme's default stroke as drawn; a text element's own ink |
