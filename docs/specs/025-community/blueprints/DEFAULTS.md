# Community blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                  | Default applied                                                                                              |
| --- | --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| C1  | community | Which migration number                        | 0068 (0067 went to agent changesets)                                                                         |
| C2  | community | Post id shape                                 | 10 characters from the share-code alphabet, so post URLs read like share links                               |
| C3  | community | How far Load More pages                       | Offset paging capped at 2400 (100 pages); beyond that, search or filter                                      |
| C4  | community | How many popular tags                         | 24, by number of listed posts                                                                                |
| C5  | community | How search matches                            | Up to 5 whitespace-separated terms, each a case-insensitive substring of title, description or tags (AND)    |
| C6  | community | Shape of the community key                    | A UUID v4 from `crypto.randomUUID`, validated by pattern on the worker                                       |
| C7  | community | Rate for likes and reports                    | 30 writes per 60 s per network, a dedicated limiter so it never competes with document writes                |
| C8  | community | Order of More Like This                       | Same category, most liked first, newest as the tie-break, the post itself excluded                           |
| C9  | community | Port for local development                    | 3005 (3002 live, 3003 telemetry, 3004 help)                                                                  |
