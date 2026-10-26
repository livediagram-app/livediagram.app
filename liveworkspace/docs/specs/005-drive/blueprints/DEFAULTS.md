# Drive blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint | Default applied                                                                                           |
| ---- | --------- | --------------------------------------------------------------------------------------------------------- |
| DRV1 | drive     | the staging Worker inherits the top-level `[limits] cpu_ms`; wrangler does not repeat it per environment. |
| DRV2 | drive     | Google's `GOOGLE_APP_ID` and Picker key are optional; without them the config answer carries `null`.      |
