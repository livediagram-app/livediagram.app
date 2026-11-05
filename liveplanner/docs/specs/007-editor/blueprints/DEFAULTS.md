# Editor blueprint defaults

One row per default applied where a spec is silent or qualitative. A row marked retired belonged to a blueprint whose
feature is gone (Power user mode, [Power user mode](../power-user-mode.md)); it keeps its number so later rows keep theirs.

| #   | Blueprint       | Spec silence                                                  | Default applied                                                                                              |
| --- | --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1  | appearance      | Lifetime of the OS watch                                      | One `MediaQueryList`, attached on first subscribe or write, never detached                                   |
| D2  | appearance      | Content of the `darkreader-lock` meta                         | `'true'`: Dark Reader keys on the name alone, and Next drops a meta with empty content                       |
| D3  | retired         | What a "day" is for the offer's session count                 | The local calendar day, `YYYY-MM-DD` from the device clock                                                   |
| D4  | retired         | What counts as "a keyboard shortcut used"                     | A keydown the editor's global shortcut listener newly claims (`defaultPrevented` false before, true after)   |
| D5  | retired         | Whether counting stops after the offer                        | It continues; the latch alone stops the offer                                                                |
| D6  | retired         | Shape of a palette tile without its caption                   | The existing icon-only tile (`hideCaption`), named by a Tooltip                                              |
| D7  | role-pill       | Selection when switching to the view preview                  | Cleared, so no edit toolbar lingers into viewing                                                             |
| D8  | retired         | Look of the role status icon                                  | The status bar control box, in the role's emerald or amber rather than the bar's slate                       |
| D9  | retired         | Malformed offer counters                                      | Reset to zero with a `[power-user-offer]` warning                                                            |
| D10 | retired         | Where Help sits in the Explorer's menu                        | First row of the app band, above Search                                                                      |
| D11 | retired         | Order of the mode's children                                  | Minimal Chrome first (a setting), then the preset readout (a summary)                                        |
| D12 | retired         | How "Change" goes to a row                                    | Select the row's category and ring the row, the search result path                                           |
| D13 | ui-scale        | How a value between steps resolves                            | Snapped to the nearest 5% step, then rounded to 2 decimals                                                   |
| D14 | ui-scale        | Where the row sits in Appearance                              | Second, after Theme                                                                                          |
| D63 | load-recovery   | How long "Trying a fresh start" shows before the reload       | 1.5 s (`AUTO_RELOAD_DELAY_MS`): long enough to read, short against the 30 s already waited                   |
| D64 | load-recovery   | Where the self-healing reload's claim is remembered           | Its own sessionStorage map, `liveplanner:load-auto-reloads`, through the stale-build guard's `claimReloadIn` |
| D65 | load-recovery   | How long "Copied" shows                                       | 2 s (`COPIED_FOR_MS`)                                                                                        |
| D66 | offline-changes | Whose queue a browser holds                                   | One per plan and person (owner id in the key); another person's is left untouched until they return          |
| D67 | offline-changes | A stored queue that cannot be read                            | Read as empty (logged); the key is rewritten by the next change                                              |
| D68 | offline-changes | A new sheet, a sheet's delete or a failed send past the bound | Still sent from this tab's memory (its element is already placed), only not kept across a reload             |
