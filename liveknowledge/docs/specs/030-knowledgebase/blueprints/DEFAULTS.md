# Knowledgebase blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                                              | Default applied                                                                                 |
| --- | --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D1  | continuous-page | How short a page may be                                   | `CONTINUOUS_PAGE_MIN_HEIGHT`, 240 px: the margins and a Title's line; the window fills the rest |
| D2  | continuous-page | The tallest a page may be                                 | `CONTINUOUS_PAGE_MAX_HEIGHT`, 4,000,000 px, its own limit and not Fit to Content's 19,200 px    |
| D3  | continuous-page | Which way the page grows                                  | Downwards from a fixed top, so nothing placed in the writing moves                              |
| D4  | continuous-page | A page added later, before it is named                    | "Untitled Page"                                                                                 |
| D5  | continuous-page | A template's header, footer, page numbers and page breaks | Left out as the template is built; the writing itself is kept                                   |
| D6  | continuous-page | A page's height before any editor has laid it out         | The layout estimator's (`withArticleHeightEstimated`), written with an agent's `write_article`  |
| D7  | continuous-page | An article stored on paper pages (an imported JSON tab)   | Kept on its paper pages, paginating as livedocuments does                                       |
