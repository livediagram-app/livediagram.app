# Microsoft Whiteboard import fixtures

| File                    | Origin                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `board-markup.ts`       | Builders for synthesised exports, mimicking the markup read from Whiteboard's bundle (E-5) |
| `zip-writer.ts`         | A minimal Zip writer (stored and deflated entries), tests and generator only               |
| `generate.ts`           | Writes the files below; deterministic                                                      |
| `synth-busy-board.html` | Synthesised: pens, a thick circle, a highlighter, a wide outline-only stroke, a note       |
| `synth-busy-board.zip`  | The same board as a Full export Zip (stored entries, as Whiteboard writes)                 |

Synthesised fixtures stand in until real exports are available. Real exports are committed only
with their owner's permission, and are listed here with their origin.
