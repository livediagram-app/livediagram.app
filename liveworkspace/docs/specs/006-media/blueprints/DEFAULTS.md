# Media blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint    | Default applied                                                                      |
| ---- | ------------ | ------------------------------------------------------------------------------------ |
| MED1 | media        | the same bytes uploaded twice by one owner are one image, answered `deduped: true`.  |
| MED2 | media        | when the app can't draw a picture, a stale private picture is served before a `503`. |
| MED3 | media        | the unused-image sweep pauses until every keyed app has reported its references.     |
| MED4 | libraries    | the Save dialog suggests the destination's existing folders, sorted.                 |
| MED5 | libraries    | an old shape library is copied whole on its first tidy, so its folder stays one.     |
| WLK1 | walkthroughs | the per-person caps are 50 walkthroughs and 1 GiB, in both environments.             |
| WLK2 | walkthroughs | recording is an Editor's; any reader plays; the recorder or an Editor deletes.       |
| WLK3 | walkthroughs | a tab-scoped link and a Community visit see no walkthroughs.                         |
| WLK4 | walkthroughs | a pending walkthrough is swept after an hour.                                        |
