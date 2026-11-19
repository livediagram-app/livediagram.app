# Notifications blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint | Default applied                                                                                                     |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| NT1 | toasts    | a muted toast under a key updates its record, rather than adding one, while that record is under 10 s old.          |
| NT2 | toasts    | a record still `live` when its list is read back after a reload is treated as `missed`: it left without being seen. |
| NT3 | toasts    | a plain toast repeated while the same one is up (deduped) is not written to the list again.                         |
| NT4 | toasts    | a toast closed by its own feature (`dismissAction`: an Undo that ran, an account that answered) counts as seen.     |
