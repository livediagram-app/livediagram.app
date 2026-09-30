# Whiteboard blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint            | Spec silence                                                 | Default applied                                                                                                                                   |
| --- | -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | whiteboard-round-one | Which template category Whiteboard belongs to                | `design`, nominal: the picker shows Whiteboard only as a quick-pick, as it does Blank                                                             |
| D2  | whiteboard-round-one | Which tool is in hand when a whiteboard opens                | The active pen, when editable and no other intent or mode (eraser, highlighter, laser …) is held                                                  |
| D3  | whiteboard-round-one | Where a split stroke's label, link, note and comments go     | The longest piece                                                                                                                                 |
| D4  | whiteboard-round-one | Which tools the "touch pans once a pen is seen" rule covers  | Every inking tool: the pens and the eraser                                                                                                        |
| D5  | whiteboard-round-one | The dots and grid colour                                     | A faint mix of ink over board, `#d6d3cb`, in light (dark: the spec)                                                                               |
| D6  | whiteboard-round-one | The eraser's brush size on a whiteboard                      | Stroke 10 px, Partial 16 px (screen)                                                                                                              |
| D7  | whiteboard-round-one | How finely Partial cuts a stroke                             | Densify to half the brush radius (at least 1 px); 12 bisection steps per crossing                                                                 |
| D8  | whiteboard-round-one | Whether the eraser mode persists                             | Yes, device-locally with the pens and recognition                                                                                                 |
| D9  | whiteboard-round-one | Where the dock sits beside the bottom-right cluster          | Lifted above the cluster (history, layers, zoom) until the viewport is 1500 px wide                                                               |
| D10 | whiteboard-round-one | Whether a pressureless stroke simulates pressure             | No: it draws at the middle pressure, the preset width all along; perfect-freehand's simulation at a 1 px size thins a mouse stroke to about 0.44x |
| D11 | whiteboard-round-one | How a pen stroke stored before pressure and streamline draws | At the middle pressure with no streamline: its points were smoothed when it landed                                                                |
| D12 | whiteboard-round-one | How many samples a pen move gives                            | One per pointermove, no coalesced events, as Excalidraw: its streamline values are tuned to that rate                                             |
| D13 | whiteboard-round-one | The pressure of the point where a pen lifts                  | The last pressure: a lifted pen reports 0, which would pinch the end                                                                              |
| D14 | whiteboard-round-one | Which pointers record pressure                               | A `pen` only: a finger reports 0.5, or a contact force that engines disagree on                                                                   |
