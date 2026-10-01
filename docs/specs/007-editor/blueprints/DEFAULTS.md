# Editor blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                                  | Default applied                                                                                            |
| --- | --------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | appearance      | Lifetime of the OS watch                      | One `MediaQueryList`, attached on first subscribe or write, never detached                                 |
| D2  | appearance      | Content of the `darkreader-lock` meta         | `'true'`: Dark Reader keys on the name alone, and Next drops a meta with empty content                     |
| D3  | power-user-mode | What a "day" is for the offer's session count | The local calendar day, `YYYY-MM-DD` from the device clock                                                 |
| D4  | power-user-mode | What counts as "a keyboard shortcut used"     | A keydown the editor's global shortcut listener newly claims (`defaultPrevented` false before, true after) |
| D5  | power-user-mode | Whether counting stops after the offer        | It continues; the latch alone stops the offer                                                              |
| D6  | power-user-mode | Shape of a palette tile without its caption   | The existing icon-only tile (`hideCaption`), named by a Tooltip                                            |
| D7  | power-user-mode | Selection when switching to the view preview  | Cleared, so no edit toolbar lingers into viewing                                                           |
| D8  | power-user-mode | Look of the role status icon                  | The status bar control box, in the role's emerald or amber rather than the bar's slate                     |
| D9  | power-user-mode | Malformed offer counters                      | Reset to zero with a `[power-user-offer]` warning                                                          |
| D10 | power-user-mode | Where Help sits in the Explorer's menu        | First row of the app band, above Search                                                                    |
| D11 | power-user-mode | Order of the mode's children                  | Minimal Chrome first (a setting), then the preset readout (a summary)                                      |
| D12 | power-user-mode | How "Change" goes to a row                    | Select the row's category and ring the row, the search result path                                         |
| D13 | ui-scale        | How a value between steps resolves            | Snapped to the nearest 5% step, then rounded to 2 decimals                                                 |
| D14 | ui-scale        | Where the row sits in Appearance              | Second, after Theme                                                                                        |
