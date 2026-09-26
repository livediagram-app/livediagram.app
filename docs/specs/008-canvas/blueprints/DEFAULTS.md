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
