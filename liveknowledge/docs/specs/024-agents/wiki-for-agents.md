# Wiki for agents

Status: **spec**, not built ([Build plan](../005-project-roadmap/build-plan.md) step 13).

The wiki as a knowledge base for AI: the MCP server and the CLI speak in pages, and every answer carries how far it
can be trusted.

## MCP tools

The platform tools every app has stay (find, create, rename, share, archive, delete and restore, with "wiki" in their
words). The page tools replace livedocuments' element and page-layout tools:

| Tool               | Does                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `get_context`      | The wiki's Always in Context pages as Markdown, in tree order, within the budget. Call it first.                                   |
| `list_pages`       | The page tree: ids, titles, depth, verified state, owner, review date.                                                            |
| `search_pages`     | Passages matching a query, each with its page, heading, verified state and date, `stale` and any `conflicts_with`.                 |
| `read_page`        | One page as Markdown with the same trust fields, its backlinks and its subpages.                                                  |
| `create_page`      | A new page from Markdown under a parent. Never Verified.                                                                           |
| `suggest_edit`     | A change to a page (replace a passage, or append) with a reason. Lands as a suggestion for a person to accept.                    |
| `write_page`       | Replaces a page's writing directly. Only with the `write` scope, and never on a verified page (it must use `suggest_edit`).        |
| `report_gap`       | Records a question the wiki could not answer.                                                                                      |
| `move_page`        | Moves a page in the tree.                                                                                                          |

- Scopes: `read` (get, list, search, read, report), `suggest` (plus create and suggest), `write` (plus write and
  move). A token or OAuth grant names its scopes; the default for a new connection is `read` and `suggest`.
- Every read is counted for [AI Knowledge](../030-wiki/ai-knowledge.md) under the client's name.
- Tool results are small by default (a passage, not a page) and name the next tool to call for more.

## CLI

`liveknowledge` mirrors the tools: `pages`, `search`, `read`, `new`, `suggest`, `write`, `move`, `context`, `gap`,
and `import <folder|zip>` and `export <dir>` (a wiki as a folder of Markdown, links relative), so a wiki can be kept
beside a repository.

## Share roles

An agent has the role of the person or token it acts for, narrowed by its scopes: a Viewer's agent can never suggest;
only an Editor's agent can hold `write`.
