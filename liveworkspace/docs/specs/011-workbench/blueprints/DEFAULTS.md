# Workbench blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint | Default applied                                                                                                |
| --- | --------- | -------------------------------------------------------------------------------------------------------------- |
| WB1 | workbench | an expired session's row is kept 24 hours so its refusal reads `expired` rather than `unknown`.                |
| WB2 | workbench | an allowance window is at most 7 days and its cap at most 1,000 uses; anything larger is refused as a mistake. |
| WB3 | workbench | a workspace session notes at most 500 rooms; more is treated as a runaway frame.                               |
