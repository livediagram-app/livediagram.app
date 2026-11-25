# Workbench blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint     | Default applied                                                                                                |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| WB1 | workbench     | an expired session's row is kept 24 hours so its refusal reads `expired` rather than `unknown`.                |
| WB2 | workbench     | an allowance window is at most 7 days and its cap at most 1,000 uses; anything larger is refused as a mistake. |
| WB3 | workbench     | a workspace session notes at most 500 rooms; more is treated as a runaway frame.                               |
| TS1 | tab-style     | a surface the profile does not name, or none, takes the profile's base.                                        |
| TS2 | tab-style     | the Mashup card is not filtered by a surface's look filter; it rolls from every year-round ingredient.         |
| SW1 | sidebar-width | the chosen width is kept per browser, not in the synced preferences: a width suits a screen, not a person.     |
| SW2 | sidebar-width | a kept width outside 200 to 480 px is clamped on read rather than dropped.                                     |
