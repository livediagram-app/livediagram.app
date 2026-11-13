# Document blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                         | Default applied                                                                                                      |
| --- | ------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | stroke-points | The decoded number type                              | `Float64Array`: decoding then re-encoding is exact, and geometry stays in doubles                                    |
| D2  | stroke-points | The decode cache's bound                             | 500,000 points total, least recently used out first                                                                  |
| D3  | stroke-points | What a writer does with a coordinate outside its box | Clamps float noise into `[0, 1]`; a non-finite value throws                                                          |
| D4  | stroke-points | How often an undecodable block is logged             | Once per distinct block (a 64-entry set)                                                                             |
| D5  | stroke-points | Where the debug script lives                         | `packages/document/scripts/expand-stroke-points.ts`, run by Node's type stripping with `scripts/ts-source-hooks.mjs` |
| D6  | stroke-points | Which base64 codec                                   | The codec's own table codec: the document package cannot import api-schema's                                         |
| D7  | delta-saves   | How the digest is spelled                            | SHA-256 of the elements' `JSON.stringify`, lowercase hex: the image digest's own function (`sha256Hex`)              |
| D8  | delta-saves   | How many ops a delta may carry                       | 500 (`TAB_DELTA_MAX_OPS`), refused `too_many_ops` past it                                                            |
| D9  | delta-saves   | When a delta is too large to be worth it             | Its body over half the elements' JSON (`TAB_DELTA_MAX_SHARE`)                                                        |
| D10 | delta-saves   | How many base copies the editor holds                | 16 tabs (`TAB_DELTA_BASES_MAX`), the least recently used out first                                                   |
