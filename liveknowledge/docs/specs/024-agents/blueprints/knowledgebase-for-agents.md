# Knowledgebase for agents: blueprint

Derived from [Knowledgebase for agents](../knowledgebase-for-agents.md), with
[AI Knowledge](../../030-knowledgebase/ai-knowledge.md) for suggestions and
[Verification](../../030-knowledgebase/verification.md) for trust. Built in step 13.

## Domain and naming

| Term           | Identifier                                                       | Meaning                                                                           |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Knowledgebase  | `document` in routes, tool names and `documentId`                | The api's and the index's word; every sentence a model reads says knowledgebase   |
| Page           | `tab` in the api's answers, `page` in tools and CLI              | One tab holding one article                                                       |
| Page reference | `pageNamed` (api), `pageRowNamed` (MCP)                          | A page's id, or its title when one page alone has it (case and spacing aside)     |
| Scope          | `AgentScope`: `read`, `suggest`, `write`                         | What a token may do in one knowledgebase                                          |
| Suggestion     | `KnowledgeSuggestion`, table `suggestions`, id `sg_` + 10 base32 | A passage replaced, or Markdown appended, waiting for an Editor                   |
| Trust fields   | `KnowledgePageTrust` (api), `TrustFields` (tools)                | `verified`, `verified_at`, `verified_by`, `review_due`, `stale`, `conflicts_with` |
| Review Period  | `KnowledgeReviewEvery` (api), `ReviewPeriod` (tools)             | `review_period`: `30 days`, `90 days`, `180 days`, `365 days`, `never`            |
| Agent name     | `X-Liveknowledge-Agent`                                          | The MCP client's name, as reads are counted under it                              |

## Modules

| Where                                                                                | What                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `packages/api-schema/src/knowledge.ts`                                               | The wire types of every route below                                           |
| `packages/api-schema/src/agent-scopes.ts`                                            | `AGENT_SCOPES`, `DEFAULT_AGENT_SCOPES`, `parseAgentScopes`, `agentScopesFor`  |
| `packages/knowledge/src/page-markdown.ts`                                            | `markdownHeadings`, `markdownSection`, `cutMarkdown`, `replacePassage` (pure) |
| `packages/edit-operations/src/pages/new-page.ts`                                     | `newPageFromMarkdown`: a page's tab from Markdown, for the api and the MCP    |
| `apps/api/src/knowledge/agent-grants.ts`                                             | `agent_grants`, `withAgentGrant`, `scopeRefusalOf`                            |
| `apps/api/src/knowledge/agent-seen.ts`, `connected-agents.ts`                        | `agent_seen`, `noteAgentSeen`, `seenAgents`; `connectedAgents` (pure)         |
| `apps/editor/components/ai-knowledge/AgentCard.tsx`, `useAgentWrite.ts`              | The card's menu, Allow Writing and Stop Writing                               |
| `apps/api/src/knowledge/suggestions.ts`                                              | The `suggestions` table's reads, the capped insert, the prune                 |
| `apps/api/src/knowledge/page-read.ts`                                                | `pageMarkdownOf`, `pageNamed`, `pageTrustOf`, `openConflictPages`             |
| `apps/api/src/routes/knowledge-suggestion-routes.ts`                                 | Suggest, list, accept, dismiss                                                |
| `apps/api/src/routes/knowledge-agent-routes.ts`                                      | The page tree, a page, the context, create, write, move, scopes               |
| `packages/agent-verbs/src/mcp/knowledge-schema.ts`                                   | The nine tools' input and output shapes                                       |
| `packages/agent-verbs/src/mcp/server-instructions.ts`                                | `SERVER_INSTRUCTIONS`                                                         |
| `packages/agent-verbs/src/knowledge/`                                                | `knowledgePath`, `trustFieldsOf`, `resultTrustOf`, `trustLine`: both doors'   |
| `packages/agent-verbs/src/verbs/knowledge.ts`                                        | The nine CLI commands as verbs                                                |
| `apps/mcp/src/knowledge-read-tools.ts`, `knowledge-write-tools.ts`, `create-tool.ts` | The tools' handlers                                                           |
| `apps/mcp/src/agent-name.ts`, `knowledge-client.ts`                                  | The client's name, remembered and sent                                        |
| `apps/cli/src/commands/knowledge-export.ts`, `knowledge-page-file.ts`                | `export <knowledgebase> <dir>`                                                |
| `apps/cli/src/commands/knowledge-import.ts`, `zip-reader.ts`                         | `import <folder                                                               | zip>` |

## Scopes

- `agentScopesFor({ readOnly, role, granted })`: a read-only token or a Viewer's role answers `['read']`; else the
  granted scopes (the default when no row) with `write` kept only for the `edit` role. `read` is always held.
- **Storage**: `agent_grants (token_id PRIMARY KEY, scopes, updated_at)`, made by the knowledge schema step
  (`knowledge-schema.ts`). `scopes` is the names joined by a space. No row is the default.
- **Settled once a request**: `handleDocumentRequest` calls `withAgentGrant` before any route: for a full token on
  a document path, one keyed read of `agent_grants`; for a read-only token or a person, none. The result is
  `ctx.agent = { readOnly, granted }`.
- **Narrowing**: `grantOn` (routes/context.ts) answers `role` (the narrowed one every gate reads), `personRole`
  (the person's own) and `scopes`. `roleUnderScopes`: with `write` the person's role; with `suggest` a
  Participant's at most; else a Viewer's. No route checks a scope of its own, but `POST pages`, which asks for
  `personRole === 'edit'` and `suggest`.
- **A refusal that teaches**: `scopeRefusalOf` rewrites a bare `403 { error: 'forbidden' }` to
  `403 { error: 'scope_needed', needs, scopes, message }` when the scopes are what held the token below its
  person's role. Any other answer passes as it is.
- **Granting**: `PUT /api/documents/<id>/agents/<token>/scopes { scopes }`: role `edit`, no token and no workbench
  session on the request (`403` otherwise); `400 invalid_scopes` for anything but a list of the three names.
- **Connections seen**: `agent_seen (token_id PRIMARY KEY, name, door, read_only, person_role, last_seen)`, schema
  step 13 (`agentSeenSchemaStep`), index on `last_seen`. `handleKnowledgeRoutes` notes a token after its gate
  (`noteAgentSeen`): one upsert whose `WHERE` lets it write only when the row is new, an hour old
  (`AGENT_SEEN_WRITE_GAP_MS`) or says something else, so a busy agent costs a statement a request and a write an
  hour. `name` is the reader's (`readerOf`), `door` `mcp`, `cli` or `token` (`doorOf` over `frontDoorOf`). Written
  through `knowledgeDb`: no edit. Pruned daily with the reads (90 days, `pruneAgentSeen`).
- **Connected Agents in `GET knowledge`**: `seenAgents` reads the rows of the last 30 days (`AGENT_SEEN_DAYS`), the
  latest first, 50 at most (`AGENTS_LISTED`), joined to `agent_grants`; each row's `scopes` is
  `agentScopesFor({ readOnly, role: person_role, granted })` and `canHoldWrite` is a full token of an Editor.
  `connectedAgents` joins the reads counted under the row's name and appends any agent known only by its reads
  (no `door`, `scopes` or `tokenId`). `id` is `stableHash('agent', token id)`. `tokenId` is in the answer only for
  `role === 'edit'` with no token and no workbench session on the request. Two tokens counted under one name show
  the same reads: reads are kept by name alone.
- **The editor's control** (`AgentCard`, `useAgentWrite`, `AgentWriteDialog`): for `askRights.grantAgents` (an
  Editor of the whole knowledgebase, not Offline) a card whose row carries `tokenId` has a More menu with one row,
  **Allow Writing** (`scopes` without `write`, `canHoldWrite`) or **Stop Writing** (`scopes` with `write`). The row
  opens a centred confirm dialog; on confirm the card shows the new chips at once, `PUT agents/<token>/scopes`
  goes out with `read, suggest, write` or `read, suggest`, and the overview is read again. A refusal puts the chips
  back and is said in a toast. A connection that cannot hold `write` has no menu and one line saying why.
- **Tests' harness**: `makeTestRouteContext` gives a token every scope unless a test passes `agent: 'stored'`,
  which has the room read the grant as a real request does.

## Suggestions

- **Table**: `suggestions (id, tab, agent, reason, kind, before, after, created_at)`, index on `tab`. Written
  through `knowledgeDb` (no write note: a suggestion is no edit).
- **Create** `POST pages/<page>/suggestions { reason, after, before? }`: role at least `participate` and an account
  behind the request. `reason` 1 to 500 characters; `after` not empty; the three together at most 20,000
  (`SUGGESTION_MAX_CHARS`). With `before`, the page's Markdown (`pageMarkdownOf`) must hold it in exactly one place
  (`replacePassage`: as written, else with any run of spaces and line breaks matching any other): `400
passage_not_found` or `passage_ambiguous`. The insert counts and inserts in one statement: at 50 pending
  (`SUGGESTIONS_MAX_PENDING`) it writes nothing and the route answers `409 suggestions_full`. Answers `201
{ suggestion, pending }`.
- **List** `GET suggestions`, and `suggestions` in `GET knowledge`: newest first, only those under 90 days old
  (`SUGGESTION_KEPT_DAYS`) and of pages the knowledgebase still holds.
- **Accept** `POST suggestions/<id>/accept`: role `edit`. Reads the page, applies `replacePassage` (or takes
  `after` for an append), and submits `{ article: { article: <flow>, markdown, mode } }` through `submitPages` with
  the acceptor as author: one write, relayed to open editors, the knowledge fields untouched. `409
suggestion_stale` when the passage is no longer in exactly one place or the page is gone; the row stays. On `200`
  the row is deleted and the answer is `{ tab: { id, rev } }`.
- **Dismiss** `POST suggestions/<id>/dismiss`: role `edit`; deletes the row; `204`.
- **Prune**, daily (`pruneKnowledge`): rows past 90 days, and rows whose page is gone.

## Agent routes

Each is one request for one tool. `<page>`, `parent` and `before` take a page reference; an unknown one answers
`404` (`409` in a body) `page_unknown` naming up to twelve pages, or `page_ambiguous` naming the ids. A link
confined to one page names it by id and reads any other as a plain `404`.

| Route                       | Reads and writes                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET pages`                 | The tab summaries (parent and knowledge fields are in them) and the open conflicts: no page body                     |
| `GET pages/<page>`          | One tab, its backlink rows, the open conflicts, the verifier's profile; counts a read; `?heading=`, `?maxChars=`     |
| `GET context`               | The summaries, then one tab a context page (the budget bounds them); counts a read each; answers `role`, `scopes`    |
| `POST pages`                | `newPageFromMarkdown`, `tabParentRefusal`, one tab insert, a `document-meta` relay; `id` and `pageIds` for an import |
| `PUT pages/<page>`          | The article write (`handleTabPages`): its gate, `page_verified`, held paragraphs, its relay                          |
| `POST pages/<page>/move`    | `pageMoveRefusal`, `withPageMoved`, `reorderTabs`, `writeTabParents`, a `document-meta` relay                        |
| `GET search` (for an agent) | Adds `text`, `reviewAt` and `conflictsWith` to each result: one more statement, when there are results               |

- `depth` is 1 at the top level (`pageTreeRows`).
- A new page's writing opens with its title as front matter (`withTitleFrontMatter`) unless the Markdown brings its
  own.
- `page_verified`: an article write by a token on a page whose state is `verified`, `409`. `page_review_due`: the
  same on a page whose state is `review-due`. `never-verified` alone is written.

## MCP tools

- **Catalogue**: `MCP_TOOL_VERBS` (packages/agent-verbs `verbs/mcp-tools.ts`), 24 tools, the nine page tools
  first: `get_context`, `list_pages`, `search_pages`, `read_page`, `report_gap`, `create_page`, `suggest_edit`,
  `write_page`, `move_page`; then `find_documents`, `create_document`, `rename_document`, `share_document`,
  `archive_document`, `unarchive_document`, `delete_document`, `restore_document`, `list_trash`,
  `list_templates`, `list_images`, `upload_image`, `delete_image`, `list_threads`, `change_threads`.
- **Removed**: `read_document`, `update_document`, `add_tab`, `write_article`, `search_icons`, `list_versions`,
  `restore_version`, `view_tab`, `view_live`, and the element schema resource.
- **Calls to the api, measured in `knowledge-tools.test.ts`**: one for each of the nine. `rename_document` and
  `delete_document` with `page` make two (the page tree, then the write). `create_document` makes one for the
  knowledgebase and its pages together.
- **Defaults**: `read_page` asks for 6,000 characters (`READ_PAGE_DEFAULT_CHARS`); `search_pages` answers 8
  results of the api's 20 (`SEARCH_DEFAULT_LIMIT`); `list_pages` 100 rows (`LIST_PAGES_DEFAULT_LIMIT`), with
  `under`, `limit`, `offset`. What is left out is counted (`left_out`, `more`) and every answer's `next` names the
  tool to call for it.
- **Errors**: a refusal the api worded is answered in its words (`apiRefusalOf`, packages/agent-verbs
  `api-refusal.ts`); a suggestion over 20,000 characters is refused before the api is asked.
- **The agent's name**: `agentNameOf` keeps printable ASCII, single spaces, 60 characters.
  `rememberClientName` (the Worker's `fetch`, beside the request under `waitUntil`) reads a copy of a POST `/mcp`
  body of at most 8,192 bytes, and for an `initialize` writes `agent-name:<sha256 of the token>` to `OAUTH_KV`
  for 200 days, unless it already holds that name. `clientNameFor` answers the handshake's name when this server
  saw it, else one KV read. No name: the header is not sent and the api counts the read under "MCP".

## CLI

- Nine verbs in `VERBS` and `TOP_LEVEL` (`context`, `pages`, `search`, `read`, `new`, `suggest`, `write`, `move`,
  `gap`), each its tool's route and output without `next`; a knowledgebase is addressed as every command addresses
  one (one read to resolve an id, the library's list for a name).
- **`export <knowledgebase> <dir>`**: `GET pages`, `pageFilePaths` (a page's subpages in a folder of its name),
  then a page at a time: `GET tabs/<id>`, its pictures (`GET /images/<id>`, each once an export), its file
  (`pageFileMarkdown`: `withPageLinksAsFiles` and `relativePagePath`; a zone's line gives way to the pictures in
  it, `zoneMemberIds`). A picture the api does not hand over as a picture is written as its address.
- **`import <folder|zip>`**: the files walked (or `openZip`, at most 200 MB and the engine's entry limit),
  `planImport`, the plan printed. Unless `--dry-run`: a new knowledgebase with no page (`POST /documents`) or
  `--to`, every page's id minted, then `POST pages` a page in plan order with `id`, `parent` and `pageIds`,
  twenty a batch (`IMPORT_BATCH_PAGES`), a line of progress a batch. A page the api refuses is left out with the
  pages under it; a `401`, `403` or `5xx` stops the import. A link between planned pages is written
  `[[Title]]`; a picture as its caption in italics.
- **The engine** (`@liveknowledge/knowledge-import` `markdown-folder.ts`): a file beside a folder of its own name
  is that folder's page when the folder has no `README.md` or `index.md`.

## Security and trust

- A token never raises its own scopes: the grant route refuses any request bearing a token.
- The scopes are enforced in the api, where the token's holder cannot step round them; the MCP adds none.
- The agent's name is display only: it never gates anything, is cut to what a header carries, and the token it is
  remembered against is stored as its hash.
- A suggestion's Markdown is read when accepted by the same reader as any article write: no markup of its own.
- What a page says reaches a model as data: the server instructions and `read_page`'s description say so.

## Performance and limits

| What                            | Cost                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| A token's request on a document | One keyed read of `agent_grants`; none for a read-only token or a person       |
| A token's knowledge request     | One guarded upsert of `agent_seen`: a row written an hour at most              |
| `GET pages`                     | The summaries (already read for the gate) and one read of at most 50 conflicts |
| `GET context`                   | One tab a context page: bounded by the 8,000 token budget                      |
| Accept                          | One page read, one article write                                               |
| A tool call                     | One api request; one KV read for the client's name                             |
| `export`                        | One page held at a time; a picture fetched once                                |
| `import`                        | One request a page; the engine reads a page's source when its turn comes       |

| Constant                      | Value    |
| ----------------------------- | -------- |
| `SUGGESTIONS_MAX_PENDING`     | 50       |
| `SUGGESTION_MAX_CHARS`        | 20,000   |
| `SUGGESTION_MAX_REASON_CHARS` | 500      |
| `SUGGESTION_KEPT_DAYS`        | 90       |
| `AGENT_NAME_MAX_CHARS`        | 60       |
| `AGENT_SEEN_WRITE_GAP_MS`     | 1 hour   |
| `AGENTS_LISTED`               | 50       |
| `HANDSHAKE_MAX_BYTES`         | 8,192    |
| `AGENT_NAME_TTL_SECONDS`      | 200 days |
| `READ_PAGE_DEFAULT_CHARS`     | 6,000    |
| `IMPORT_BATCH_PAGES`          | 20       |

## Observability

`[knowledge] suggested`, `suggestion accepted`, `suggestion stale`, `suggestion dismissed`, `page created`,
`page moved`, `scopes granted`, `scope needed`, `agent not noted`; `[pages-agent] refused` with `page_verified` or
`page_review_due`; `[mcp] client name
not remembered`, `client name not read`. Ids and counts, never a page's words. Each tool reports `Mcp·Used` as
every tool does.

## Testing

| Rule                                                                 | Test                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Scopes by token kind, role and grant                                 | `packages/api-schema/src/agent-scopes.test.ts`                                             |
| Suggest, accept, dismiss by role; stale; the cap; the prune          | `apps/api/src/routes/knowledge-suggestion-routes.test.ts`                                  |
| The agent routes by role and scope; a page by title; `page_verified` | `apps/api/src/routes/knowledge-agent-routes.test.ts`                                       |
| `page_review_due`; Connected Agents per role; the hourly write       | `apps/api/src/routes/knowledge-agent-routes.test.ts`                                       |
| Allow Writing and Stop Writing per role, the confirm, the rollback   | `apps/editor/components/ai-knowledge/AiKnowledgeView.test.tsx`                             |
| Sections, cuts and passages                                          | `packages/knowledge/src/page-markdown.test.ts`                                             |
| One request a tool, the name sent, trust fields, sizes, refusals     | `apps/mcp/src/knowledge-tools.test.ts`                                                     |
| `review_period` said once; no tool takes a review interval           | `apps/mcp/src/knowledge-tools.test.ts`, `packages/agent-verbs/src/verbs/knowledge.test.ts` |
| The client's name                                                    | `apps/mcp/src/agent-name.test.ts`                                                          |
| The tools' words and shapes                                          | `packages/agent-verbs/src/verbs/mcp-tools.test.ts`, `mcp/schema.test.ts`                   |
| The CLI's commands                                                   | `packages/agent-verbs/src/verbs/knowledge.test.ts`                                         |
| Export, import, the zip reader                                       | `apps/cli/src/commands/knowledge-files.test.ts`, `zip-reader.test.ts`                      |
