# Telemetry blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #    | Blueprint | Default applied                                                                                    |
| ---- | --------- | -------------------------------------------------------------------------------------------------- |
| TEL1 | telemetry | a D1 error on insert loses the batch, logged `[telemetry] batch lost`; ingest still answers `204`. |
| TEL2 | telemetry | every refusal answers `204` with nothing stored, so a sender learns nothing from the answer.       |
| TEL3 | telemetry | of more than 100 valid events in one batch, the first 100 are stored.                              |
