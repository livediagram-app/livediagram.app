# Media blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint | Default applied                                                                      |
| ---- | --------- | ------------------------------------------------------------------------------------ |
| MED1 | media     | the same bytes uploaded twice by one owner are one image, answered `deduped: true`.  |
| MED2 | media     | when the app can't draw a picture, a stale private picture is served before a `503`. |
| MED3 | media     | the unused-image sweep pauses until every keyed app has reported its references.     |
| MED4 | libraries | the Save dialog suggests the destination's existing folders, sorted.                 |
| MED5 | libraries | an old shape library is copied whole on its first tidy, so its folder stays one.     |
