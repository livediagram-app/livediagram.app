# Export blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint  | Default applied                                                                                             |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| EX1 | vector-pdf | a fallback picture is drawn at 3 device px per CSS px, held under 8 MP.                                     |
| EX2 | vector-pdf | text-layer runs on one baseline join when the gap is under 3 em; a gap over 0.1 em reads as a space.        |
| EX3 | vector-pdf | the PDF's language is the editor page's `lang` attribute; none is written when it is unset.                 |
| EX4 | vector-pdf | a table's header cells are column headers (`/Scope /Column`): the writing's only header is its first row.   |
| EX5 | vector-pdf | a picture that fails to load is left out of its page (logged), the rest of the page still drawn.            |
| EX6 | vector-pdf | a Figure goes before the first new block of its page that starts below its top edge; none such, after them. |
