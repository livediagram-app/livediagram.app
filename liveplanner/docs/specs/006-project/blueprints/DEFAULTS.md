# Project blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint      | Spec silence                                         | Default applied                                                                                                                         |
| --- | -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | stroke-points  | The decoded number type                              | `Float64Array`: decoding then re-encoding is exact, and geometry stays in doubles                                                       |
| D2  | stroke-points  | The decode cache's bound                             | 500,000 points total, least recently used out first                                                                                     |
| D3  | stroke-points  | What a writer does with a coordinate outside its box | Clamps float noise into `[0, 1]`; a non-finite value throws                                                                             |
| D4  | stroke-points  | How often an undecodable block is logged             | Once per distinct block (a 64-entry set)                                                                                                |
| D5  | stroke-points  | Where the debug script lives                         | `packages/project/scripts/expand-stroke-points.ts`, run by Node's type stripping with the monorepo root's `scripts/ts-source-hooks.mjs` |
| D6  | stroke-points  | Which base64 codec                                   | The codec's own table codec: the project package cannot import api-schema's                                                             |
| D7  | last-seen-copy | Where the last seen copies live                      | IndexedDB `liveplanner-last-seen`, stores `copies` and `seen`, keyed reader and plan                                                    |
| D8  | last-seen-copy | How many cards a copy keeps                          | Up to 1,000 (`PLAN_COPY_MAX_CARDS`); past it none, and a Board or Dashboard first tab opens as always                                   |
| D9  | last-seen-copy | How many sheet cells a copy keeps                    | Up to 10,000 across the first tab's sheets (`PLAN_COPY_MAX_CELLS`); past it none                                                        |
| D10 | last-seen-copy | When the kept sheets refresh                         | On each read of the first tab's sheets (open, resync, refetch), not on each cell write                                                  |
| D11 | last-seen-copy | What a warm paint may do                             | Everything a Viewer may: the paint runs as `view` whatever role the copy holds, until the catch-up                                      |
