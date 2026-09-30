# Whiteboard blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint            | Spec silence                                                | Default applied                                                                                  |
| --- | -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| D1  | whiteboard-round-one | Which template category Whiteboard belongs to               | `design`, nominal: the picker shows Whiteboard only as a quick-pick, as it does Blank            |
| D2  | whiteboard-round-one | Which tool is in hand when a whiteboard opens               | The active pen, when editable and no other intent or mode (eraser, highlighter, laser …) is held |
| D3  | whiteboard-round-one | Where a split stroke's label, link, note and comments go    | The longest piece                                                                                |
| D4  | whiteboard-round-one | Which tools the "touch pans once a pen is seen" rule covers | Every inking tool: the pens and the eraser                                                       |
| D5  | whiteboard-round-one | The dots and grid colour                                    | A faint mix of ink over board, `#d6d3cb`, in light (dark: the spec)                              |
| D6  | whiteboard-round-one | The eraser's brush size on a whiteboard                     | Stroke 10 px, Partial 16 px (screen)                                                             |
| D7  | whiteboard-round-one | How finely Partial cuts a stroke                            | Densify to half the brush radius (at least 1 px); 12 bisection steps per crossing                |
| D8  | whiteboard-round-one | Whether the eraser mode persists                            | Yes, device-locally with the pens and recognition                                                |
| D9  | whiteboard-round-one | Where the dock sits beside the bottom-right cluster         | Lifted above the cluster (history, layers, zoom) until the viewport is 1500 px wide              |
| D10 | whiteboard-round-one | Whether the corner angle differs per pointer kind           | One `CORNER_TURN_DEG` (100) for all: the curve renders stored strokes, which record no pointer   |
| D11 | whiteboard-round-one | How far one simplifier chord may reach in samples           | `SIMPLIFY_MAX_WINDOW` 256 samples, so a slow stroke's per-point check stays bounded              |
| D12 | whiteboard-round-one | Samples whose timestamps do not increase                    | Equal time replaces the previous sample (never the first); an earlier time is dropped            |
