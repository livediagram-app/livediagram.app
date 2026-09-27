# Canvas blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                              | Default applied                                                                                                     |
| --- | ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | arrow-anchors | "A small grazing tolerance"                               | `PATH_INSIDE_INSET_PX = 2`: a path must go more than 2 px inside the outline to count                               |
| D2  | arrow-anchors | How the drawn path is tested against a shape              | Clip each segment to the connector box, sample every 2 px, at most 512 samples per segment                          |
| D3  | arrow-anchors | "Equally close"                                           | Distances within `CLOSENESS_TIE_PX = 0.5` are equal                                                                 |
| D4  | arrow-anchors | What "cross" means for paths meeting at an end point      | Proper intersection farther than 1 px from every path end point; collinear overlap is not a crossing                |
| D5  | arrow-anchors | How long swapping repeats; very busy sides                | At most 8 passes per element; a side with more than 32 ends is skipped and logged                                   |
| D6  | arrow-anchors | Log level and when to log in a per-frame pass             | `console.debug` with the `[arrow-rebind]` prefix, only for triggered arrows and swaps                               |
| D7  | arrow-anchors | Order of decisions within a run                           | Arrows in document order, `from` before `to`; swaps per element in document order, pairs `i < j`                    |
| D8  | arrow-anchors | The outlines of `actor` and `stadium`                     | Actor: convex hull of head, arm tips and feet down to the label band; stadium: capsule with 16-segment half circles |
| D9  | arrow-anchors | Which of an element's ends the swap looks at              | Every pinned end on the element that is not part of a self-loop, whether or not its arrow is considered             |
| D10 | arrow-anchors | Outward direction of a quarter                            | The side normal, like its middle                                                                                    |
| D11 | arrow-anchors | Return value when nothing changes                         | The input array itself, so callers can skip work on reference equality                                              |
| D12 | arrow-anchors | Stored `manual` flags after the rule stopped reading them | A rewritten end is a fresh `{ kind, elementId, anchor }`, so the inert flag falls away                              |
| D13 | arrow-anchors | How a curved outline (cloud, document) is sampled         | Cubic curves at 12 segments each; only `M L C Z` absolute commands, the ones those paths use                        |
| D14 | arrow-anchors | How a kind declares its anchors                           | A per-shape-kind list of anchor ids with an all-sixteen default, so a new kind gets 16 until decided otherwise      |
| D15 | arrow-anchors | Where face-placed anchors come from                       | Derived from the kind's polygon vertices at load, so a silhouette change moves its anchors with it                  |
| D16 | arrow-anchors | Quick-connect from a side without anchors                 | The offered anchor nearest the side's middle, first in table order on a tie                                         |
| D17 | arrow-labels  | Order in which labels claim space                         | Arrows in document order; each sees the knockouts placed before it                                                  |
| D18 | arrow-labels  | Longest segment tie                                       | First in draw order                                                                                                 |
| D19 | arrow-labels  | "Balanced" lines                                          | Smallest width keeping the greedy line count; 8 binary-search steps                                                 |
| D20 | arrow-labels  | "Nearest spot that is clear"                              | Twelfths of the open run, within a quarter run of the preferred centre, forward first                               |
| D21 | arrow-labels  | Which boxes a label avoids                                | Every boxed element except `frame` and `lane` containers, own endpoints included                                    |
| D22 | arrow-labels  | A word wider than the cap                                 | Never broken; the line overflows the cap                                                                            |
| D23 | arrow-labels  | Measure fails (NaN)                                       | 7 px per char at 12 px, scaled by font size                                                                         |
| D24 | arrow-labels  | Word-width cache bound                                    | 2 000 entries, cleared when full                                                                                    |
| D25 | arrow-labels  | Cap between horizontal and vertical                       | `cross + (along - cross) * u.x^2`, smooth in the angle                                                              |
| D26 | arrow-labels  | Which elements a label pass sees                          | The whole tab, hidden layers included, on the canvas and in every export alike                                      |
| D27 | arrow-bending | "A little way in from each end"                           | The grab fraction is clamped to 0.2 to 0.8                                                                          |
| D28 | arrow-bending | Snapping while bending by the line                        | None; the handles keep their snapping, a line bend is freehand                                                      |
| D29 | arrow-bending | Bowing a zero-length arrow                                | Inserts one bend point instead                                                                                      |
| D30 | arrow-bending | "Close together" for a double-press                       | Within 8 screen px and 450 ms, the existing window                                                                  |
| D31 | arrow-labels  | Which label box the selection toolbars clear              | The plate rect; the toolbar gap already clears the knockout margin                                                  |
