# One AI connection

One MCP server for every app with an MCP of its own (livediagram, liveplanner, livedocuments, livedesign,
liveknowledge), behind one OAuth consent and one token (Work Tracker 1370). livehuddle has no MCP, so it has no
tools here.

**The one MCP.** The server runs at `https://mcp.liveworkspace.app/mcp` and is the only MCP any page, help
article or listing names. It is the only MCP Worker: each app's tools are a package the app owns and this Worker
runs, and the apps' old addresses (`mcp.<app>.app`) are routes on it that carry existing connections
([The app MCPs fold in](#the-app-mcps-fold-in)).

## Why

Today an assistant connects to each app separately: five connections, five sign-ins, five tokens against the
account's 20, five tool lists (about 150 tools, 600 KB). Cross-app work ("turn this retro into a plan and write it
up") needs several connections set up in advance. Merging the lists alone would make picking worse: livediagram,
livedocuments and liveknowledge already share names (`create_document`, `find_documents`, `share_document`). So the
server is shaped to pick better than five servers, and the eval says whether it does.

## Three layers

1. **Core verbs, always listed.** Ten tools that work on any item:

   | Tool                   | Does                                                                                                 |
   | ---------------------- | ---------------------------------------------------------------------------------------------------- |
   | `find_items`           | Finds items by name across the apps; `kind` narrows to one kind, `where` reads archived or the Trash |
   | `read_item`            | Reads one item (its tabs and their content, as the app's own read tool does)                         |
   | `create_item`          | Makes an item of a `kind`: diagram, deck, article, infographic, plan, design, knowledgebase          |
   | `share_item`           | Shares an item by link with a role                                                                   |
   | `rename_item`          | Renames an item                                                                                      |
   | `trash_item`           | Moves an item to the Trash                                                                           |
   | `restore_item`         | Restores an item from the Trash                                                                      |
   | `list_app_tools`       | Lists one kind's editing tools, with their input schemas                                             |
   | `read_with_app_tool`   | Calls one of those tools that only reads (`readOnlyHint`), by name                                   |
   | `change_with_app_tool` | Calls one of those tools that changes something, by name                                             |

   An item is named by its **ref**, `<kind>:<id>` (`diagram:Ab3…`), which `find_items` and `create_item` answer.
   The kinds and the app each belongs to: `diagram` (livediagram), `doc` (livedocuments: a deck, an article or an
   infographic; `create_item` takes those three as kinds and answers a `doc:` ref), `plan` (liveplanner), `design`
   (livedesign), `knowledgebase` (liveknowledge).

2. **Editing tools, on demand.** Each app's other tools (diagram elements, board cards, sheet cells, article
   writing, knowledgebase pages) come back from `list_app_tools(kind)`, each marked `readOnly` or not, and run through
   `read_with_app_tool` or `change_with_app_tool`. An assistant normally sees ten tools, not about 150.
   So that finding a tool takes one call, not two, `list_app_tools`' description names every kind's tools, reads
   and changes apart (about 1,250 tokens more); a name it gets wrong answers with the names it has. And the item a
   tool works on can be given as a ref, on the verb (`ref`) or in its arguments: it goes in as the app's own id
   argument (`projectId`, `documentId`, `designId`), which is the argument assistants most often got wrong. A client with its own tool search (it defers tool definitions until
   needed) connects to `/mcp?tools=all` instead: that lists the core verbs and every editing tool, each callable
   by name.

3. **Names by what they make, never by app.** Every editing tool is renamed from its app's name:
   - the app's own item word becomes its kind: `update_document` in livediagram is `update_diagram`,
     `create_project` in liveplanner is `create_plan`, `find_documents` in liveknowledge is `find_knowledgebases`;
   - a name with no subject of its own gets its kind after the verb: `add_tab` is `add_diagram_tab`,
     `add_plan_tab`, `add_doc_tab`; `upload_image`, `list_templates`, `change_threads` the same;
   - liveknowledge's page tools say whose pages they are: `create_knowledge_page`, `search_knowledge_pages`;
   - a handful read better by hand: liveplanner's `change_items` and `list_items` are `change_cards` and
     `list_cards`; liveknowledge's `get_context`, `report_gap`, `suggest_edit` and `request_approval` are
     `get_knowledge_context`, `report_knowledge_gap`, `suggest_knowledge_edit`, `request_knowledge_approval`.

   No two tools share a name, and no name says a bare "document". A naming test fails on a clash, on "document", or
   on a name with no subject word (the kinds, and card, sheet, board, form, article, item, app_tool). Every
   description opens with the noun people use and the app ("For a diagram (livediagram)."), and every old tool name
   inside a description, the app's instructions, a prompt, a view, a refusal or an answer's own guidance (its `next`
   and `note`) is rewritten to its new name, so an answer's "call read_document next" says `read_diagram`. What a
   person wrote (a page, a card, a comment, a cell) comes back exactly as written, even when it names a tool. The apps' deprecated aliases (livediagram's `*_diagram(s)` names) are not listed.

## Fit for Claude's connector directory

The server is built to be listed in Claude's connector directory, so it meets its review criteria
(claude.com/docs/connectors/building/review-criteria), checked again whenever they change:

- **Every tool has a `title` and the hints that apply**, said in full rather than left to the defaults:
  `readOnlyHint: true` on a tool that only reads, `destructiveHint` true or false on every other. An editing tool
  keeps its app's own annotations, title and all, under its new name.
- **Reading and changing never share a tool.** The directory refuses one tool that does both, so an editing tool
  runs through `read_with_app_tool` (read-only, and it refuses a tool that changes anything) or
  `change_with_app_tool` (marked destructive, and it refuses a read-only tool, naming the other).
- **Input schemas any client can send on**: JSON Schema every draft reads alike, so no tuples (mcp-kit says them
  as plain arrays with an exact length).
- **No instructions out of place**: descriptions say what a tool does and when; they never send the assistant to
  other tools the person didn't ask for, nor to outside instructions. What items hold is data.
- **Sign-in as the directory expects**: OAuth 2.1 with S256 PKCE, dynamic client registration, a 401 with
  `resource_metadata` for a missing or refused token, and `https://claude.ai/api/mcp/auth_callback` and loopback
  redirects accepted (mcp-kit's authorization server). Every answer that carries a token says
  `Cache-Control: no-store` (RFC 6749 §5.1), and Cancel on the consent page sends the person back to the client
  with `error=access_denied` (RFC 6749 §4.1.2.1), so the AI tool stops waiting rather than hanging on a page that
  says to close it.
- **Streamable HTTP, stateless**: every request is answered on its own, with no session id. `POST /mcp` carries
  the JSON-RPC; `GET /mcp` with a token answers `405 Method Not Allowed` (the spec's way to say the server opens no
  stream of its own: it never sends a message nobody asked for), so a client never holds an empty stream open or
  keeps reconnecting one.
- **Readable from a browser**: every answer, the old addresses' and the refused token's 401 included, allows any
  origin and exposes `WWW-Authenticate` and `Mcp-Session-Id`, so a client running in a page (the MCP Inspector, a
  web app) can read the challenge and start signing in. The Bearer token is the authorization, never the origin.

Before submitting: public docs, a privacy policy and support links, which wait until the trial ends.

## How it works

A router in front of each app's tools, in one Worker. Each app's MCP is a package in that app's folder
(`<app>/apps/mcp`: its tools, prompts, resources and views, with their tests), and this Worker runs each one in
process, as the person, with the person's own `Authorization: Bearer lwt_…` (an account token works on every app).
An app's tools reach its api over this Worker's service binding to that api. An app's answer comes back as it is,
the old tool names in its guidance and refusals rewritten, never in what a person wrote. A refused token (401 from any app) makes the whole request answer 401 with the sign-in
challenge.

The core verbs map to each app's existing tools: `find_items` to `find_documents`, `find_projects` or
`find_designs` (or `list_trash` with `where: "trash"`), across every allowed app at once, five at most, each app's
matches marked with their refs; `read_item` to the app's read tool (`list_pages` for a knowledgebase); `create_item`
to its create tool, a deck, article or infographic starting from livedocuments' blank slide deck, blank article or
blank infographic template; the rest to the matching share, rename, delete and restore tools. An app that fails
during `find_items` is named in the answer with its error; the others still answer.

Each app's tool list is read from its package once per isolate and kept 10 minutes.

### Nothing an app's MCP offers is lost

Everything each app's own MCP serves reaches the person through the one MCP, for the apps they allowed:

- **Every tool.** Each app tool runs through `read_with_app_tool` or `change_with_app_tool`, or by its own name (all
  of them are listed with `?tools=all`), the views' own `view_*` tools too, as each app's MCP lists them: a host
  without MCP Apps lets the model call them for a picture, and with `?tools=all` each keeps its `_meta`, so a host
  with MCP Apps keeps the ones marked for the view alone from the model.
- **Each app's guidance.** The server instructions each app's MCP gives (liveknowledge's trust and health rules,
  livedocuments' pictures, archived items, and so on) come back from `list_app_tools(kind)` as `guide`, old tool
  names rewritten, read once per isolate and kept 10 minutes.
- **Prompts.** Every allowed app's prompts are listed (`prompts/list`) and run (`prompts/get`) through the app, the
  app's item word in a name made its noun (`show_my_document` is `show_my_diagram`, `show_my_doc` and
  `show_my_knowledgebase`; `show_my_project` is `show_my_plan`), and old tool names in their texts rewritten.
- **Resources.** Every allowed app's resources (the element schemas, the views' `ui://` pages) are listed and read
  through the app that owns the URI (`<app>://…` or `ui://<app>/…`), old tool names in their texts rewritten, so a
  view calls its tools by their names here.
- **Interactive views.** A tool that links an app's view keeps its `_meta`, so with `?tools=all` a host with MCP
  Apps shows the view beside the result. Through the core verbs, which serve every app, the result's picture shows
  instead, as in a host without MCP Apps.

## Sign-in and per-app consent

OAuth 2.1 with PKCE and dynamic registration, the same as each app's MCP (`@liveworkspace/mcp-kit`). The consent
page is liveworkspace.app's `/oauth/consent` (signed in, never indexed, linked from nowhere). It lists the five apps,
each ticked; clearing one keeps that app's tools away from this connection. Approving makes an ordinary account
token named after the client (the Settings panel's API Tokens list it, and revoke it), hands it to the server, and
the server keeps which apps it may reach, by the token's hash, as long as the client's registration. A token with no
such record (one pasted from Settings) reaches every app; when the record can't be read (the store fails), the request
answers 503, try again, rather than guessing, so a failure never widens a connection to every app. A reconnect replaces the client's earlier token, as each
app's MCP does. Cancel mints nothing: the server forgets the request and the browser goes back to the client's
redirect address with `error=access_denied` (and its `state`), so the AI tool says the connection was declined; when
the request has already expired, the page says the connection was cancelled.

## The app MCPs fold in

Each app keeps its MCP's code, in its own folder, and owns its tools; what goes is the app's MCP Worker. This
Worker runs every app's MCP, so there is one deploy, one KV namespace and one place to test the whole connection.

- **What each app's package is handed.** Its api (`LIVEDIAGRAM_API`, `LIVEDOCUMENTS_API`, ... service bindings on
  this Worker), its editor's origin for links (`<APP>_BASE_URL`), the short-lived scratch KV (this Worker's
  `OAUTH_KV`, which keeps a token's client name by the token's hash, the same for every app) and its telemetry key
  (`<APP>_TELEMETRY_KEY`, the same secret as that app's api `TELEMETRY_KEY`), so `Mcp·Used` stays counted per app.
  A deployment that sets no telemetry key sends no MCP telemetry for that app.
- **Its old address.** `mcp.<app>.app` is a custom domain on this Worker. A request to `/mcp` there with a token is
  passed through to that app's own MCP package as it is, so a connection made before the fold keeps the tool names,
  descriptions, instructions, prompts and resources it was given, until its token ends (a client holds the tool list
  it read and calls those names). A token whose per-app consent leaves that app out gets the pointer at
  `https://mcp.liveworkspace.app/mcp` instead. Its sign-in endpoints refuse in words that point there: registration,
  authorize and the token exchange; its discovery metadata says the same. A token that ended answers 401 with that
  pointer. `/health` answers there, for the status page.
- **The apps' own consent and device pages are removed.** Their CLIs sign in here (below).
- **Its tests stay with it.** Each app's MCP package keeps its unit tests and eval; this Worker's tests cover the
  routing, the old addresses and the wiring of each package.

**The CLIs sign in here.** Each app's API reports this server as its `oauthIssuer`, so every CLI version signs in
through it with no new release: its built-in clients are the five CLIs (`<app>-cli`), each verified. Browser
sign-in uses the same consent page without the app list (a CLI calls the app's API, not this server); device
sign-in uses liveworkspace.app's `/oauth/device`.

**Moving the old addresses.** A custom domain belongs to one Worker, so each app's MCP Worker is deleted before this
Worker's deploy claims its address (docs/ci.md "Deploys"); between the two, the old address does not answer.

## What people are told

One address, in every place a person could copy one (Work Tracker 1423):

- **Every Build with AI page and help article** names `https://mcp.liveworkspace.app/mcp` and nothing else. The
  client steps are written once, in `@liveworkspace/marketing-site`'s `aiClients`, and every product's page and
  liveknowledge's Connect view render them: the connection is named `liveworkspace` in every client, and the
  product's name appears only where it says which app to keep ticked on the approval page.
- **Prompts name their app or what they make** ("In liveplanner, make a kanban board for ..."), because one
  connection holds every app's tools and a vague request could land in the wrong one. The help article "Connecting AI
  Tools" has a few that cross apps (a plan's status as a livedocuments article, a retro board as a livediagram mind
  map), which is what one connection is for.
- **Tool names in copy are this server's** (`create_item`, `change_cards`, `get_knowledge_context`), never an app's
  own name for the tool.
- **Someone still on an app's old address** is told it takes no new connections, that a connection made before
  keeps working until its token ends, and that some old hosts no longer resolve; they remove the server and add the
  one address once, ticking every app they use. The note lives in the shared troubleshooting list and the help
  article "Connecting AI Tools", and nowhere else.
- **A guard keeps it so**: `.github/scripts/old-mcp-host-guard.mjs` (the Checks job's **One MCP address** step, so every change runs it) fails when a tracked text file names
  `mcp.<app>.app` (or its staging host) outside this Worker, tests, the migration note, specs and the developer docs.

## The tool-pick eval

Before the server is listed anywhere, an eval measures whether it picks better than the five servers:

- about 60 realistic requests, each with the tool it should lead to and the key arguments;
- run against (a) the five app servers' tool lists together and (b) this server, both its default ten and
  `?tools=all`, with a current Claude model and a smaller one;
- reports the right-tool rate, the right-arguments rate, calls per task and the tool-list tokens.

In (b), `list_app_tools` is answered as the server would and the model goes on, up to four steps; a request counts
as picked by its first call that is not discovery. Nothing runs: the eval reads which tool the model calls, never
calls it. The server is listed only when (b) matches or beats (a) on both rates with fewer tool-list tokens.

The eval runs by hand with an Anthropic key in the environment (never in the repo); its last result is recorded in
the repo. CI runs the part that needs no model on every change to a tool (the naming rules, the catalogue built from
the recorded tool lists, every request's expected tool still existing), so a renamed or new tool can't quietly break
picking.

## Limits

- Requests are as each app's MCP allows: the router adds no limit of its own beyond mcp-kit's registration limits.
- One `find_items` call is at most five app calls; any other call is one app call (two for the first call in an
  isolate, which also reads that app's tool list).
