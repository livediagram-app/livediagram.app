# Event storming blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint    | Spec silence                                             | Default applied                                                                                   |
| --- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | lanes-always | Which note of a selection "the first workshop note" is   | The first workshop note among the drag's moved ids, in the order the drag captured them           |
| D2  | lanes-always | Which note decides a selection's lane step on arrow keys | The single selection when it is a workshop note, else the first workshop note in document order   |
| D3  | lanes-always | Whether the settle moves a note on a hidden layer        | Yes: hidden is not pinned; only `locked` notes stay                                               |
| D4  | lanes-always | How close to a lane centre counts as on it               | `LANE_EPSILON = 0.5` canvas px                                                                    |
| D5  | lanes-always | Where a row starts and ends                              | A box joins the row while its centre is less than half a lane height below the row's first centre |
| D6  | lanes-always | Non-finite coordinates                                   | Passed through unchanged; validation owns them                                                    |
| D7  | lanes-always | Which note of a photo column sets its left edge          | The top-most member; ties by id                                                                   |
| D8  | lanes-always | What "centred on the pointer" means for several notes    | The centre of the boxed elements' bounding box                                                    |
| D9  | lanes-always | Which MCP notes are arriving                             | New ids, and workshop notes whose `x` or `y` an op changed; in replace mode, every workshop note  |
| D10 | lanes-always | Settle toast copy                                        | "Lined up N notes on the lanes." (singular for one)                                               |
