# Formulas

A [sheet](sheet.md)'s cells hold **inputs**; what they show are **values**. A formula is an input that starts with
`=` and works its value out from other cells, other sheets on the tab and the document's Plan cards. The language
is the one people already write in Google Sheets and Excel: the same operators, references and function names, so
a formula pasted from either works here when it uses what this page lists.

Values are worked out in the browser (and by the api and MCP for images and agents) by the same pure engine, so
everyone sees the same values for the same inputs; only number formats differ by the viewer's locale.

## Values

A value is one of:

| Kind        | Is                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------- |
| **empty**   | A cell with no input; reads as `0` in arithmetic and `""` in text                        |
| **number**  | A double; dates and times are numbers (days since 30 December 1899, the time a fraction) |
| **text**    | A string, up to 10,000 characters                                                        |
| **boolean** | `TRUE` or `FALSE`                                                                        |
| **error**   | One of the errors below                                                                  |
| **array**   | Rows of values, from a range or a function; shown by spilling (below)                    |

### Errors

| Error     | When                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| `#DIV/0!` | Division by zero                                                                      |
| `#VALUE!` | A value of the wrong kind (`="a"+1`)                                                  |
| `#REF!`   | A reference to a cell that was deleted, a sheet not on the tab, or a circular formula |
| `#NAME?`  | A function or name the engine does not know                                           |
| `#N/A`    | A lookup found nothing; `NA()`                                                        |
| `#NUM!`   | A number out of range (`=SQRT(-1)`, a result too large)                               |
| `#SPILL!` | An array result blocked by filled cells, or past the grid                             |
| `#ERROR!` | A formula that cannot be read (only from an agent or a paste: the editor refuses one) |

- An error flows through: a formula reading an error shows it, except the functions that test for errors
  (`IFERROR`, `IFNA`, `ISERROR`, `ISNA`, `ERROR.TYPE`).
- A **circular** formula (one that reads itself, directly or through others) shows `#REF!` in every cell of the
  loop, and hovering says "Circular reference: B2 → C2 → B2". There is no iterative calculation.

## What a typed input becomes

What is typed into a cell (or pasted, imported or written by an agent) is read once, when it is saved, and stored
as what it means, never as the text typed, so everyone reads it the same whatever their locale:

| Typed                                   | Stored as                                         | Format it takes (if Automatic) |
| --------------------------------------- | ------------------------------------------------- | ------------------------------ |
| `=…`                                    | A formula                                         | (the formula's)                |
| `12`, `-3.5`, `1,234.5`, `1.2e3`        | A number                                          | Automatic                      |
| `12%`                                   | `0.12`                                            | Percent                        |
| `£12`, `$1,200.50`, `€3`, `-£4`         | A number                                          | Currency, with that symbol     |
| `8/10/2026`, `2026-10-08`, `8 Oct 2026` | A date number (day and month in the locale order) | Date                           |
| `14:30`, `2:30 pm`, `14:30:15`          | A time fraction                                   | Time                           |
| `2026-10-08 14:30`                      | A date and time number                            | Date Time                      |
| `true`, `FALSE` (any case)              | A boolean                                         | Automatic                      |
| `'anything`                             | The text after the `'`                            | Automatic                      |
| Anything else                           | Text                                              | Automatic                      |

- A cell already formatted as **Plain Text** keeps whatever is typed as text.
- Separators are read in the typist's locale (`1.234,5` is a number to someone whose locale writes it so).
- The formula bar shows a stored number unformatted (`0.12`, or the date in the locale's short form).

## References

- **A1 references**: `B4`; absolute parts with `$` (`$B$4`, `B$4`, `$B4`), which do not shift when the formula is
  copied, filled or pasted.
- **Ranges**: `A1:C5`, whole columns `A:C`, whole rows `2:4`, and open ends of a filled column (`A2:A`).
- A reference past the grid (`ZZ1` on a 26-column sheet) is `#REF!`.
- References are not case sensitive; they are stored upper case.

### Other sheets

- `'Sheet title'!B4` (quotes needed when the title holds a space or a symbol; `Budget!B4` otherwise) reads a cell
  of another sheet **on the same tab**, by its title; a range too (`'Q3 Costs'!A1:D20`).
- Renaming a sheet rewrites every formula on the tab that names it; a reference to a title no sheet on the tab has
  (deleted, or never there) is `#REF!` until a sheet of that title is there again.
- Inserting or deleting rows and columns in a sheet rewrites references to it in every sheet on the tab.
- Sheets on other tabs and other documents are out of reach.

### Named ranges

- A **named range** gives a cell or a range of a sheet a name (`TaxRate`, `Q3_Sales`): `=B2*TaxRate` reads it, and
  as a name never shifts, filling or copying the formula keeps reading the same cells (what `$B$1` does, readably).
- A name is read as its range: a single cell as its value, a range where a range goes (`=SUM(Q3_Sales)`).
- A name is looked up in the formula's own sheet first, then in the one other sheet on the tab that has it; one that
  none has, or that several other sheets have, is `#NAME?` ("Unknown name TAXRATE"). Names are not case sensitive.
- Names follow their cells: rows and columns inserted inside a named range grow it, moved ones carry it; a range
  whose cells are all deleted loses its name, and formulas using it read `#NAME?`.
- A name in a formula is kept as typed; renaming or removing a name does not rewrite formulas.

### Plan cards

Four functions read the document's [items](../026-plan/items.md) (its cards), every live card (not archived, not in
the Trash), whatever board they are on, as a [plan view](../026-plan/plan-views.md) reads them:

| Function                                | Gives                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `CARDCOUNT([field, value, …])`          | How many cards match every `field, value` pair                                     |
| `CARDSUM(sum_field, [field, value, …])` | The sum of a number field over the matching cards                                  |
| `CARD(number, field)`                   | One field of card `#number`                                                        |
| `CARDS(fields, [field, value, …])`      | A spilled table: a header row of `fields`, then a row per matching card, by number |

- A **field** is named as the card panel names it, case ignored: `"Title"`, `"State"` (or `"Status"`),
  `"Assignee"`, `"Priority"`, `"Estimate"`, `"Due"`, `"Start"`, `"Labels"`, `"Type"`, `"Number"`, or a custom
  field's name. `fields` in `CARDS` is one text of names separated by commas (`"Number, Title, State"`).
- A **value** matches as a criterion does in `COUNTIF` (`"Done"`, `">3"`, `"<>"`, `"*login*"`).
- Values read as: State by its column name, Assignee by the person's name, Labels joined with `, `, dates as date
  numbers, Type by the card type's name, Number as the number.
- An unknown field is `#NAME?` (hovering names it); a card number no card has is `#N/A`.
- A sheet using these functions loads the document's items, as a board does; until they arrive the cells show
  **Loading…**. They recalculate as cards change, live for everyone.
- Outside the editor (exports, images, agents), they read the items the api reads.

## Operators

In order of precedence, highest first; same as Google Sheets:

| Operator                   | Does                                 |
| -------------------------- | ------------------------------------ |
| `:`                        | Range                                |
| `-` (prefix)               | Negation                             |
| `%` (postfix)              | Divide by 100                        |
| `^`                        | Power                                |
| `*` `/`                    | Multiply, divide                     |
| `+` `-`                    | Add, subtract                        |
| `&`                        | Join text                            |
| `=` `<>` `<` `>` `<=` `>=` | Compare; text compares ignoring case |

- Brackets group. Text is in double quotes, a quote inside doubled (`"say ""hi"""`). Array constants are written
  `{1, 2; 3, 4}` (commas between columns, semicolons between rows).
- Arithmetic reads text that looks like a number as the number (`="3"+1` is `4`); other text is `#VALUE!`.
- A formula is at most 8,000 characters and nests functions at most 64 deep.

## Arrays and spills

- A formula whose value is an array (`=A1:A5*2`, `=FILTER(…)`, `=SORT(…)`, `=SEQUENCE(5)`, `=CARDS(…)`) **spills**:
  its first value shows in its cell and the rest fill the cells below and to the right. Spilled cells are drawn
  as values with no input of their own; selecting one shows the formula greyed in the bar.
- A spill blocked by a cell with an input shows `#SPILL!` in the formula's cell ("The result would overwrite
  B3"); emptying the blocker lets it spill.
- A reference to a spilling cell followed by `#` (`=SUM(B2#)`) reads its whole spilled range.
- Spilled cells are worked out, never stored: a CSV export and an agent read their values; an import or paste
  writes inputs only into cells it covers.

## Functions

The engine knows the functions below (and only these: any other name is `#NAME?`). Arguments in brackets are
optional. Each behaves as its Google Sheets namesake; where Sheets and Excel differ, Sheets wins.

**Maths**: `SUM`, `SUMIF`, `SUMIFS`, `SUMPRODUCT`, `PRODUCT`, `ABS`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `INT`,
`TRUNC`, `MOD`, `POWER`, `SQRT`, `EXP`, `LN`, `LOG`, `LOG10`, `PI`, `SIGN`, `CEILING`, `FLOOR`, `MROUND`, `RAND`,
`RANDBETWEEN`, `QUOTIENT`, `GCD`, `LCM`, `FACT`.

**Statistics**: `AVERAGE`, `AVERAGEIF`, `AVERAGEIFS`, `MEDIAN`, `MODE`, `MIN`, `MAX`, `MINIFS`, `MAXIFS`, `COUNT`,
`COUNTA`, `COUNTBLANK`, `COUNTIF`, `COUNTIFS`, `LARGE`, `SMALL`, `RANK`, `PERCENTILE`, `QUARTILE`, `STDEV`,
`STDEV.P`, `VAR`, `VAR.P`, `CORREL`.

**Logic**: `IF`, `IFS`, `SWITCH`, `AND`, `OR`, `XOR`, `NOT`, `TRUE`, `FALSE`, `IFERROR`, `IFNA`.

**Information**: `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISLOGICAL`, `ISERROR`, `ISNA`, `ISFORMULA`, `ERROR.TYPE`, `NA`,
`N`, `TYPE`.

**Lookup**: `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `LOOKUP`, `INDEX`, `MATCH`, `XMATCH`, `CHOOSE`, `ROW`, `ROWS`, `COLUMN`,
`COLUMNS`, `OFFSET`, `INDIRECT` (an A1 text on this sheet or another on the tab).

**Text**: `CONCAT`, `CONCATENATE`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `PROPER`, `TRIM`,
`CLEAN`, `SUBSTITUTE`, `REPLACE`, `FIND`, `SEARCH`, `REPT`, `EXACT`, `TEXT`, `VALUE`, `CHAR`, `CODE`, `SPLIT`,
`JOIN`, `REGEXMATCH`, `REGEXEXTRACT`, `REGEXREPLACE`, `HYPERLINK`.

**Date and time**: `TODAY`, `NOW`, `DATE`, `TIME`, `DATEVALUE`, `TIMEVALUE`, `YEAR`, `MONTH`, `DAY`, `HOUR`,
`MINUTE`, `SECOND`, `WEEKDAY`, `WEEKNUM`, `ISOWEEKNUM`, `EDATE`, `EOMONTH`, `DATEDIF`, `DAYS`, `NETWORKDAYS`,
`WORKDAY`, `YEARFRAC`.

**Arrays**: `FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `SEQUENCE`, `TRANSPOSE`, `ARRAYFORMULA`.

**Finance**: `PMT`, `FV`, `PV`, `NPV`, `IRR`, `RATE`, `NPER`.

**Plan cards**: `CARDCOUNT`, `CARDSUM`, `CARD`, `CARDS`.

- **Criteria** (`COUNTIF`, `SUMIFS`, ... and the card functions) take a value to equal, or a text starting with a
  comparison (`">=10"`, `"<>Done"`), with `*` and `?` as wildcards and `~` to escape them; text matches ignore
  case.
- `TEXT(value, format)` takes the spreadsheet format codes people use (`"0.00"`, `"#,##0"`, `"0%"`, `"dd/mm/yyyy"`,
  `"mmm yyyy"`, `"hh:mm"`, `"[h]:mm"`, `"£#,##0.00"`, `"@"`).
- `HYPERLINK(url, [label])` shows the label as a link; Ctrl/⌘ and a click opens it in a new tab (http, https and
  mailto only).
- `REGEX…` functions take JavaScript regular expressions, and stop with `#VALUE!` after 50 ms on one cell.
- `TODAY`, `NOW`, `RAND`, `RANDBETWEEN`, `OFFSET` and `INDIRECT` are **volatile**: they recalculate on every
  change to the sheet, and `TODAY`/`NOW` also once a minute while the sheet is in view. `RAND` is worked out in
  each browser, so two people see different numbers, as in a spreadsheet shared live.

## Recalculation

- A change recalculates only the cells that depend on it (directly or through others), plus volatile ones.
- A sheet's values are worked out the first time it is drawn, and kept while its document is open.
- A recalculation that would take longer than a frame is done in parts, values filling in as they are ready; cells
  waiting show their last value, faded.
- The engine bounds its work: a formula reading more than 1,000,000 cells, or a recalculation of more than
  5,000,000 cell reads, stops with `#NUM!` in the cells it did not reach and says "This sheet is too large to
  recalculate at once".
