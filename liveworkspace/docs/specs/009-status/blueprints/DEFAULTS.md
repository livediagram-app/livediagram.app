# Status blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint | Default applied                                                   |
| --- | --------- | ----------------------------------------------------------------- |
| ST1 | status    | a probe that hangs is cut at 10 s and counted `down` (`timeout`). |
| ST2 | status    | a service missing from a run keeps its open incident open.        |
| ST3 | status    | yesterday's daily row is never rewritten after midnight UTC.      |
