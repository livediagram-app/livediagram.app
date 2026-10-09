# Sheets blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                   | Default applied                                                            |
| --- | ------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| D1  | sheets-engine | How row and column ids are made                | 6-character random base-36 ids, made by the client; a collision is refused |
| D2  | sheets-engine | A write's byte size                            | 1 MB, so one D1 parameter stays well under its 2 MB value limit            |
| D3  | sheets-engine | Largest array a formula may return             | 100,000 values                                                             |
| D4  | sheets-engine | How the regex time limit is enforced           | A work estimate (text length × pattern length) up to 10,000,000            |
| D5  | sheet-store   | Largest room op before clients refetch instead | 256 KB                                                                     |
| D6  | sheet-store   | How much the daily expiry deletes per run      | 25 sheets read a query, 100,000 cells a batch, 500,000 cells a run         |
| D7  | sheet-store   | Sheets named in one GET                        | 50                                                                         |
| D8  | sheet-store   | Cells an agent reads at once                   | 5,000                                                                      |
| D9  | sheet-element | Toolbar, formula bar and status bar heights    | 44, 28 and 24 px                                                           |
| D10 | sheet-element | Row and column header sizes                    | 46 px wide row numbers, 22 px tall column letters                          |
| D11 | sheet-element | How near a header edge a resize starts         | 4 px                                                                       |
| D12 | sheet-element | Edge distance that auto-scrolls a drag         | 24 px                                                                      |
| D13 | sheet-element | How often presence is sent while selecting     | At most every 120 ms                                                       |
| D14 | sheets-engine | Two-digit years                                | Below 70 are 20xx, else 19xx                                               |
| D15 | sheet-element | The cell editor's mechanism                    | A textarea with a reference-colouring overlay                              |
| D16 | sheet-element | Most lines a freeze keeps                      | 100 rows and 26 columns (`SHEET_FREEZE_ROWS_MAX`, `SHEET_FREEZE_COLS_MAX`) |
| D17 | sheet-element | How many rows Add Rows adds                    | 100, changeable in its field, up to the grid's limit                       |
| D18 | sheet-element | How many Find matches are highlighted          | The first 2,000                                                            |
| D19 | sheet-element | Status bar: cells counted, and its pick        | Up to 100,000 cells; the pick kept per browser                             |
| D20 | sheet-element | Largest CSV a canvas drop reads                | 8 MB                                                                       |
| D21 | sheet-element | Whether a remounted Sheet keeps its selection  | Yes, per sheet for the session (up to 200 sheets), within the grid         |
| D22 | sheet-element | How near the frozen edge's bar a press grabs   | 3 px                                                                       |
| D23 | sheet-store   | How much one agent read answers                | 100,000 characters (`SHEET_READ_CHARS_MAX`), with a note where to read on  |
