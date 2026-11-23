# Architecture blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint    | Default applied                                                                                  |
| ---- | ------------ | ------------------------------------------------------------------------------------------------ |
| ARC1 | architecture | a forward loop is answered `508 Loop Detected` as plain text, never retried.                     |
| ARC2 | architecture | a sign-in's cookies live on an app's address for at most 15 minutes, whatever liveworkspace set. |
| ARC3 | room-restore | a repeated name in one call's `names` is restored once, answered once.                           |
| ARC4 | room-restore | the door answers `Cache-Control: no-store` on every answer.                                      |
