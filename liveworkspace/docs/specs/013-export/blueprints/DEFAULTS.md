# Export blueprint defaults

One row per default applied where a spec is silent. Each code is cited in its blueprint's "Defaults ledger".

| #   | Blueprint  | Default applied                                                                                            |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| EX1 | vector-pdf | a fallback picture is drawn at 3 device px per CSS px, held under 8 MP.                                    |
| EX2 | vector-pdf | text-layer runs on one baseline join when the gap is under 3 em; a gap over 0.1 em reads as a space.       |
| EX3 | vector-pdf | the PDF's language is the editor page's `lang` attribute; none is written when it is unset.                |
| EX4 | vector-pdf | a list item, quote or table cell of an article is tagged P (the writer tags headings and paragraphs only). |
| EX5 | vector-pdf | a picture that fails to load is left out of its page (logged), the rest of the page still drawn.           |
