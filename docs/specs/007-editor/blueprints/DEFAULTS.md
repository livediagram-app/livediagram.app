# Editor blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                                                   | Default applied                                                                                            |
| --- | --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | appearance      | Lifetime of the OS watch                                       | One `MediaQueryList`, attached on first subscribe or write, never detached                                 |
| D2  | appearance      | Content of the `darkreader-lock` meta                          | `'true'`: Dark Reader keys on the name alone, and Next drops a meta with empty content                     |
| D3  | power-user-mode | What a "day" is for the offer's session count                  | The local calendar day, `YYYY-MM-DD` from the device clock                                                 |
| D4  | power-user-mode | What counts as "a keyboard shortcut used"                      | A keydown the editor's global shortcut listener newly claims (`defaultPrevented` false before, true after) |
| D5  | power-user-mode | Whether counting stops after the offer                         | It continues; the latch alone stops the offer                                                              |
| D6  | power-user-mode | Shape of a palette tile without its caption                    | The existing icon-only tile (`hideCaption`), named by a Tooltip                                            |
| D7  | power-user-mode | Selection when switching to the view preview                   | Cleared, so no edit toolbar lingers into viewing                                                           |
| D8  | power-user-mode | Look of the role status icon                                   | The status bar control box, in the role's emerald or amber rather than the bar's slate                     |
| D9  | power-user-mode | Malformed offer counters                                       | Reset to zero with a `[power-user-offer]` warning                                                          |
| D10 | power-user-mode | Where Help sits in the Explorer's menu                         | First row of the app band, above Search                                                                    |
| D11 | power-user-mode | Order of the mode's children                                   | Minimal Chrome first (a setting), then the preset readout (a summary)                                      |
| D12 | power-user-mode | How "Change" goes to a row                                     | Select the row's category and ring the row, the search result path                                         |
| D13 | ui-scale        | How a value between steps resolves                             | Snapped to the nearest 5% step, then rounded to 2 decimals                                                 |
| D14 | ui-scale        | Where the row sits in Appearance                               | Second, after Theme                                                                                        |
| D15 | editor-modes    | Where the remembered mode is kept                              | One `localStorage` key per tab, `livediagram:v2:editor-mode:<tabId>`, never pruned                         |
| D16 | editor-modes    | Whether an opening-mode change moves people already on the tab | No: the mode a tab opened in is pinned per page once it has loaded                                         |
| D17 | editor-modes    | Who may choose Opens in on a locked tab                        | Nobody: the choices show, disabled                                                                         |
| D18 | editor-modes    | How Opens in stores Diagram                                    | Written explicitly (`opensIn: 'diagram'`), not deleted                                                     |
| D19 | editor-modes    | Where Opens in sits in the tab menu                            | An accordion section after Content, its rows icon, name, description and a dot                             |
| D20 | editor-modes    | Which tools a switch puts down besides the other mode's        | The eraser in both directions; a palette-armed shape on entering Draw                                      |
| D21 | editor-modes    | How Ink is stored by name                                      | `penColour` / `penTextColour: 'ink'`, a `PenColourName` beside the seven hued ones                         |
| D22 | editor-modes    | A migrated board's unpainted shape label                       | `penTextColour: 'ink'`, as the board drew it                                                               |
