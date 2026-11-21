# Knowledgebase blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                                              | Default applied                                                                                        |
| --- | --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| D1  | continuous-page | How short a page may be                                   | `CONTINUOUS_PAGE_MIN_HEIGHT`, 240 px: the margins and a Title's line; the window fills the rest        |
| D2  | continuous-page | The tallest a page may be                                 | `CONTINUOUS_PAGE_MAX_HEIGHT`, 4,000,000 px, its own limit and not Fit to Content's 19,200 px           |
| D3  | continuous-page | Which way the page grows                                  | Downwards from a fixed top, so nothing placed in the writing moves                                     |
| D4  | continuous-page | A page added later, before it is named                    | "Untitled Page"                                                                                        |
| D5  | continuous-page | A template's header, footer, page numbers and page breaks | Left out as the template is built; the writing itself is kept                                          |
| D6  | continuous-page | A page's height before any editor has laid it out         | The layout estimator's (`withArticleHeightEstimated`), written with an agent's `write_article`         |
| D7  | continuous-page | An article stored on paper pages (an imported JSON tab)   | Kept on its paper pages, paginating as livedocuments does                                              |
| D8  | editing         | When the draft is made                                    | At the first change in edit mode, never on Edit: an Edit and a Cancel with nothing typed store nothing |
| D9  | editing         | Who saves while others edit                               | Anyone editing; the others stay in edit mode on the new saved page, their next change a new draft      |
| D10 | editing         | Where the draft bar stands                                | In the top row, in Edit's place before Page Info and Share                                             |
| D11 | editing         | How fresh "Unsaved changes from X, <when>" is             | The record moves at most once a minute (`DRAFT_TOUCH_MS`)                                              |
| D12 | editing         | An agent's write and the draft's change to the same block | The draft's wins; the agent's other blocks stay (`mergeDraftOverSaved`)                                |
