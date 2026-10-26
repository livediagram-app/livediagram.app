# Community blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint | Default applied                                                                        |
| ---- | --------- | -------------------------------------------------------------------------------------- |
| COM1 | community | Load More stops at offset 2,400 (`nextOffset: null`).                                  |
| COM2 | community | a report answers the same `204` whether or not it hid the post.                        |
| COM3 | community | an unknown stored category reads as `other`, and a malformed `tags` column as no tags. |
