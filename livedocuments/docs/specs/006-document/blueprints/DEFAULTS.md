# Document blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint      | Spec silence                                         | Default applied                                                                                                                          |
| --- | -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | stroke-points  | The decoded number type                              | `Float64Array`: decoding then re-encoding is exact, and geometry stays in doubles                                                        |
| D2  | stroke-points  | The decode cache's bound                             | 500,000 points total, least recently used out first                                                                                      |
| D3  | stroke-points  | What a writer does with a coordinate outside its box | Clamps float noise into `[0, 1]`; a non-finite value throws                                                                              |
| D4  | stroke-points  | How often an undecodable block is logged             | Once per distinct block (a 64-entry set)                                                                                                 |
| D5  | stroke-points  | Where the debug script lives                         | `packages/document/scripts/expand-stroke-points.ts`, run by Node's type stripping with the monorepo root's `scripts/ts-source-hooks.mjs` |
| D6  | stroke-points  | Which base64 codec                                   | The codec's own table codec: the document package cannot import api-schema's                                                             |
| D1  | last-seen-copy | Where the last seen copies live                      | IndexedDB `livedocuments-last-seen`, stores `copies` and `seen`, keyed reader and document                                               |
| D2  | last-seen-copy | How many copies are kept                             | 20 (`LAST_SEEN_MAX_COPIES`), the oldest seen out first                                                                                   |
| D3  | last-seen-copy | How large a copy may be                              | 1,000,000 characters of JSON (`LAST_SEEN_MAX_CHARS`); past it none is kept and an older one goes                                         |
| D4  | last-seen-copy | How old a copy may be read                           | 30 days (`LAST_SEEN_MAX_AGE_MS`)                                                                                                         |
| D5  | last-seen-copy | How long a store call may take                       | 1,000 ms (`LAST_SEEN_TIMEOUT_MS`), then it answers as if empty                                                                           |
