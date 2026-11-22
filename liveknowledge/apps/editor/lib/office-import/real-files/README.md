# Real Office files

Files written by Word and PowerPoint, kept unchanged as import fixtures
(`../real-files.test.ts`). They come from the test files of two MIT-licensed projects,
python-docx 1.2.0 and python-pptx 1.0.2 (sdists on PyPI), whose licences sit beside them
(`LICENSE-python-docx`, `LICENSE-python-pptx`; Copyright (c) 2013 Steve Canny). They hold no
personal data.

| File                        | Source           | What it exercises                                   |
| --------------------------- | ---------------- | --------------------------------------------------- |
| `par-known-paragraphs.docx` | python-docx, MIT | Paragraphs as Word writes them                      |
| `sty-known-styles.docx`     | python-docx, MIT | Paragraph styles Word names                         |
| `tbl-having-tables.docx`    | python-docx, MIT | Word tables                                         |
| `txt-font-props.docx`       | python-docx, MIT | Runs in other faces, sizes and colours              |
| `test.pptx`                 | python-pptx, MIT | A PowerPoint slide with title and body placeholders |
| `txt-font-typeface.pptx`    | python-pptx, MIT | Text boxes set in named typefaces                   |

No Google Docs or Google Slides export is kept yet: the owner's checklist on the pull request
that added these files asks for one of each, to be added here with its licence line.
