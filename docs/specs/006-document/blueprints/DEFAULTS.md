# Document blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                         | Default applied                                                                   |
| --- | ------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| D1  | stroke-points | The decoded number type                              | `Float64Array`: decoding then re-encoding is exact, and geometry stays in doubles |
| D2  | stroke-points | The decode cache's bound                             | 500,000 points total, least recently used out first                               |
| D3  | stroke-points | What a writer does with a coordinate outside its box | Clamps float noise into `[0, 1]`; a non-finite value throws                       |
| D4  | stroke-points | How often an undecodable block is logged             | Once per distinct block (a 64-entry set)                                          |
| D5  | stroke-points | Where the debug script lives                         | `packages/document/scripts/expand-stroke-points.ts`, run with `tsx`               |
| D6  | stroke-points | Which base64 codec                                   | The codec's own table codec: the document package cannot import api-schema's      |
