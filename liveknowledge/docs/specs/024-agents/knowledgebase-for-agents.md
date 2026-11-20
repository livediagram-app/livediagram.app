# Wiki for agents

Status: **built** ([Build plan](../005-project-roadmap/build-plan.md) step 13), but for what
[What is built, and where it differs](#what-is-built-and-where-it-differs) lists.

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

## What is built, and where it differs

Built in step 13: the api's suggestions, scopes and agent routes, the MCP's tools, the CLI's commands. The detail is
the [blueprint](blueprints/knowledgebase-for-agents.md).

- **`report_gap` is registered with the tools that read**, after `read_page`: a read-only connection may call it.
- **A page is named by its id or its title** (where one page alone has that title), in every tool and command, and
  the api resolves it: no tool looks a page up first. `suggest_edit` names the passage as `old_text` and what
  replaces it as `new_text`; `read_page` takes `heading` or `max_chars` and sends the first 6,000 characters unless
  asked.
- **Every page and passage answer carries the trust fields**: `verified` (`verified`, `review-due`,
  `never-verified`), `verified_at`, `verified_by` (the verifier's name, on `read_page`, where the accounts service
  has one), `review_due`, `stale` (the review is due) and `conflicts_with` (the pages an open conflict names).
- **Scopes sit on the platform's tokens, which are read-only or full and nothing between.** A read-only token (the
  consent screen's choice, as before) holds `read`. A full token holds `read` and `suggest`, the default for a new
  connection. `write` is granted to one token in one knowledgebase by an Editor, in person
  (`PUT /api/documents/<id>/agents/<token>/scopes`), and is kept in that knowledgebase's room: the platform's token
  has no place for it, and the accounts service was not changed. The scopes narrow the role the token's person
  holds before any route runs, so a token without `write` acts as a Participant at most in every route of the
  knowledgebase (it cannot rename it, delete a page or restore a version either), and one with `read` alone as a
  Viewer. Sharing, archiving and deleting a whole knowledgebase are the index's, and take a full token as before.
- **A person's role still bounds the agent**: creating a page needs an Editor's agent holding `suggest`;
  suggesting needs a Participant's or an Editor's; a Viewer's agent only reads, whatever is granted.
- **`write_page` is refused on a page whose state is Verified** (`page_verified`). A page whose review is due may
  be written directly by a connection holding `write`: its verification has lapsed.
- **The agent's name** is the MCP client's `clientInfo.name` from the `initialize` handshake, cut to printable
  ASCII and 60 characters. The transport is stateless, so the name is remembered against the SHA-256 of the
  caller's token in the MCP's OAuth KV (200 days) and read back by each knowledgebase tool. The CLI's reads are
  counted under "CLI".
- **The tool descriptions tell an agent what to do** ("Call this first", "Prefer a verified passage"), as this spec
  asks, where the [MCP server](../015-api/mcp-server.md) spec's §4.15 has descriptions state facts only. A
  connector directory may flag them; the same guidance is in the server's instructions.
- **CLI**: `export <knowledgebase> <dir>` and `import <folder|zip>` take the knowledgebase and the folder as
  written here; `export --all --to <dir>` stays for a backup of every knowledgebase. `import` reads a Markdown
  folder and a Notion export. It refuses a Confluence export, which is HTML read through an inert DOM the CLI's
  runtime does not have, and leaves each picture as its caption, since the article Markdown the api takes has no
  picture form: both are imported in the app. `export` writes pictures as files under `pictures/`.
- **Not built**: the editor's control to grant a token `write` (the route is there); scopes on the OAuth consent
  screen beyond read-only or full; a suggestion's diff as removed and added lines (the card has `before` and
  `after`); the pages view of `@liveknowledge/document-views` still prints a page link's stored text, where
  `read_page` and `GET pages/<page>` print the linked page's current title.
