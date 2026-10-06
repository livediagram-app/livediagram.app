# CLI

**Status: in progress.** Built and run from source (`apps/cli`): routing, help, exit codes and output rules;
profiles, `LIVEDIAGRAM_TOKEN`, `auth login` through the browser, `--device` and `--with-token`, `status`, `logout`; the reads `document ls|view`,
`tab ls|view|lint|diff`, `changeset ls|show`; the edits `edit` (`changeset apply`), `element add|set|rm|move|connect|insert|wrap`
and `changeset revert`, based on read copies; `document create|rename|share|rm|restore`, `tab add|rename|rm`; the catalogues `template ls|view`, `icon search`,
`schema`; `graph lint` (`--compare`), offline; `comment ls|add|reply|resolve|reopen` and `presence set|clear`; `wait` and `watch` on the room; `pull`, `push`, `export --all` and a pull file's views offline; `tab render`, `graph render` and PNG export; `guide`, `skill` and `api`; the usage count and `telemetry on|off`. Not yet published to npm. The OS keychain store and the update check are ahead.

`livediagram` is a command-line front door to the api, built first for **agents** (a coding agent in a repo, a chat
agent changing a diagram while a person talks to it) and second for people (scripts, syncing documents to files).
With it an agent reads, builds, edits, comments on and reasons about documents, paying for context only when it
asks. It sits beside the [MCP server](mcp-server.md), not in place of it: the two are front doors to one set of
verbs, and the api owns every write ([Agents](../024-agents/README.md)). The research behind it is in
`docs/research/agent-cli/`.

## Principles

- **Remote-first.** Every command acts on the api. Local files are an explicit `pull`, `push` or `export`.
- **The api owns meaning.** Writes are [changesets](../024-agents/agent-changesets.md) compiled by the api; reads are
  [views](../024-agents/document-views.md) rendered by the api. The CLI parses, sends and prints, so an old install
  never writes the old way.
- **Context costs only when asked.** No definitions up front; short help; compact text by default.
- **Never interactive when piped.** A command whose stdin or stdout is not a terminal never prompts.
- **No whole-tab saves.** The CLI never writes a tab with the editor's whole-tab `PUT`. Tab content changes only by
  changesets, a new tab is a `replace` changeset on a new tab id, a tab is renamed through its name route
  (`PUT /api/documents/:id/tabs/:tabId/name`), and a new document is compiled by `POST /api/documents`.

## Commands

Resource, then verb. `doc` and `el` are accepted for `document` and `element`.

| Command                                                                | Does                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `document ls [query]`                                                  | Documents in the personal library and joined teams, newest first                     |
| `document view <doc>`                                                  | The overview view                                                                    |
| `document create <name> [--tab <name>] [-f <file>\|--template <kind>]` | A new document from a graph, Mermaid or template, compiled by the api                |
| `document rename\|share\|rm\|restore <doc>`                            | As the MCP's verbs; `rm` moves to the Trash, there is no permanent delete            |
| `tab ls <doc>`                                                         | The document's tabs                                                                  |
| `tab view <doc> [--tab <t>] [--view <name>] [--budget <n>]`            | A view; the outline by default; `show` takes `--ref`, `find` `--text`                |
| `tab add\|rename\|rm <doc> ...`                                        | Tab lifecycle; `add` takes `-f` or `--template`                                      |
| `tab diff <doc> [--tab <t>] --since <rev>`                             | The diff view, computed by the CLI from its copy of the tab at that rev              |
| `tab render <doc> [--tab <t>] --png <file>\|--svg <file>`              | A preview image; prints the path and its size, never image bytes                     |
| `tab lint <doc> [--tab <t>]`                                           | The [diagram lint](../024-agents/diagram-lint.md), served as a view                  |
| `element add\|set\|rm\|move\|connect\|insert\|wrap <doc> ...`          | One [edit operation](../024-agents/edit-operations.md) as a changeset                |
| `item ls\|add\|set\|move\|rm <doc> ...`                                | [Items](../026-plan/items.md) by number (`#12`) or id prefix; fields as `key=value`  |
| `changeset apply <doc> [--tab <t>] -f <file>\|-` (`edit`)              | Many edit operations, or a `replace`, as one changeset                               |
| `changeset ls\|show\|revert <doc> [<changeset>]`                       | Recent changesets and their revert                                                   |
| `comment ls\|add\|reply\|resolve\|reopen <doc> ...`                    | Threads ([Agent presence](../024-agents/agent-presence.md#comments)), by element ref |
| `presence set\|clear <doc> [--tab <t>] [--status ..] [--focus ..]`     | The agent's presence                                                                 |
| `wait <doc> --for comment\|change [--timeout <s>]`                     | Blocks until it happens, prints it, exits                                            |
| `watch <doc>`                                                          | Streams changes, one line each, until interrupted                                    |
| `graph lint\|render <file>`                                            | Lint or preview a graph or Mermaid file locally, before writing anything             |
| `pull <doc> [--to <dir>]` / `push <file>`                              | Sync one document to a file and back                                                 |
| `export --all --to <dir> [--format json,svg,png,mermaid,md]`           | Every document to files                                                              |
| `template ls\|view`, `icon search <text>`, `schema [kind]`             | The catalogues and the element format, from the api                                  |
| `guide [topic]`                                                        | How-tos: `build`, `edit`, `views`, `comments`, `collaborate`                         |
| `skill print\|install --to <dir>`                                      | The agent skill file                                                                 |
| `api <method> <path> [--body <file>\|-]`                               | Any api route, authenticated; the escape hatch                                       |
| `auth login\|status\|logout`                                           | Credentials                                                                          |

**Addressing.** `<doc>` is a document name, an id prefix, or a pasted livediagram URL; an ambiguous one is refused
with the candidates. A share-link URL acts through that link: each request of the command carries its code. A
pulled file's path reads its views offline. `--tab` takes a tab name or id prefix and defaults to the first tab.
Elements are [refs and selectors](../024-agents/edit-operations.md#selectors); the comment verbs take the ref of the
element whose thread they act on.

**Files.** `-f <file>` holds edit operations, a graph, Mermaid, or elements, told apart by their content; a file
that is none of them is refused.

**Changeset writes** (`element`, `changeset apply`, `tab add`, `push`) accept `--dry-run` (the plan, nothing
written), `--summary <text>`, `--base <rev>`, `--strict` and `--wait-held <seconds>`. The base defaults to the agent's
last read of that tab: the CLI keeps a local copy of each tab it reads and sends its revision with the fingerprint of
every element, so the api can tell whether what the changeset targets changed since. The same copies give
`tab diff`.

**Waiting.** `wait --for change` treats a burst of edits as one change. When `--timeout` passes, `wait` prints that
nothing new happened and exits 0.

**Provenance.** A document the CLI creates records `source: 'cli'`. Made by AI does not count it: a person directing
an agent through the CLI is designing their own diagram.

## Help

- `livediagram --help` lists the resources, how to address things, the output rules and four starting commands,
  within `HELP_TOP_MAX_TOKENS`.
- `<resource> --help` lists its verbs in a line each, within `HELP_RESOURCE_MAX_TOKENS`.
- `<resource> <verb> --help` gives usage, flags, two examples and what it prints, within `HELP_VERB_MAX_TOKENS`.
- `guide <topic>` and `schema <kind>` carry the depth, so it is paid for only when needed.
- `skill print` prints a `SKILL.md` whose frontmatter (about 60 tokens) says when to use the CLI and whose body
  points at `guide`. `skill install --to <dir>` writes it into that agent skills directory; without `--to` it lists
  the common ones.
- Help, guides and the skill come from the verb catalogue; templates, icons and the element format (`schema`) come
  from the api. Tests hold each within its budget.

## Output

- **stdout carries data only**; hints, warnings and update notices go to stderr.
- Compact text by default. `--json` gives the same data as JSON; `--json <fields>` picks fields; `-q` prints only
  refs or ids.
- Every write prints its result lines ([Edit operations](../024-agents/edit-operations.md#results)): what changed,
  the revision, the changeset, the lint summary and the revert command.
- Lists end with one line saying what was left out and how to see it, never silently cut.
- Errors name what was wrong, the valid values or candidates, and one runnable fix.

## Exit codes

| Code | Meaning                                                          |
| ---- | ---------------------------------------------------------------- |
| 0    | Done                                                             |
| 1    | Rejected: the input was understood and refused (`invalid_value`) |
| 2    | Usage: the command line does not parse                           |
| 3    | Not found or ambiguous: a document, tab or ref                   |
| 4    | Not signed in, or not permitted by the token's role              |
| 5    | Conflict or held: re-read, then retry                            |
| 6    | Rate limited                                                     |
| 7    | Network or server failure                                        |

## Authentication

In order of precedence:

1. **`LIVEDIAGRAM_TOKEN`**, an `lvd_` token from the environment: agents, CI, sandboxes. There is no `--token` flag;
   it would land in shell history and transcripts.
2. **The stored credential** of the active profile, from `auth login`.

- `auth login` runs OAuth 2.1 with PKCE through the MCP worker's authorisation server
  ([MCP server](mcp-server.md) §3) with a loopback redirect, and stores the minted `lvd_` token. `--device` uses the
  device authorisation grant for machines without a browser. `--with-token` reads a token from stdin, for hosts that
  do not run the MCP worker. The token is named "livediagram CLI"; its work shows as its owner's. A new login on a
  profile that holds a token revokes the old one once the new one works.
- Credentials go in the OS keychain when available, else `~/.config/livediagram/credentials.json` at mode 0600.
- `auth status` prints the host, account, token name, its role and expiry, never the secret, and warns inside
  14 days of expiry. `auth logout` revokes the token and forgets it.
- A host without sign-in has no tokens, so the CLI cannot act there and says so in one line, as the MCP is absent
  there ([Public API and API tokens](public-api-and-tokens.md) §3.7). The CLI never acts as a guest.
- `LIVEDIAGRAM_TOKEN` goes to whichever host is active; set `LIVEDIAGRAM_HOST` beside it for a self-host.

## Profiles and self-hosting

- `~/.config/livediagram/config.toml` names profiles, each a `host`; `--host`, `--profile`, `LIVEDIAGRAM_HOST` and
  `LIVEDIAGRAM_PROFILE` choose one. The default is `https://livediagram.app`.
- The CLI learns a host from `GET /api/capabilities`: the api base, whether sign-in and the OAuth server exist, the
  document format and the oldest CLI version it accepts (`cli.minVersion`). Below that version the CLI refuses
  writes and names the version to install. Against a host storing a newer document format than it reads, the CLI
  refuses the commands that work on local files (`pull`, `push`, `export`, `graph`, `tab diff`) the same way.
- A self-host profile never contacts livediagram.app.

## Local files

- `pull <doc>` writes `<slug>.livediagram.json`: the document, its tabs and each tab's revision. `--svg` adds a
  picture per tab.
- `push <file>` sends each changed tab as a changeset based on the pulled revision. A tab changed on the server
  since is refused as a conflict, naming it; the person pulls again. Nothing is overwritten blindly. Only elements
  are pushed: a changed tab name, theme or background, and a tab gone from the file, are named as not pushed, and
  nothing on the server is deleted.
- `export --all` writes every document, read-only, for backups and docs.

## Previews

`tab render` and `graph render` draw with the shared SVG renderer (`renderElementsToSvg`) and rasterise PNGs with
`@livediagram/render-png`, the MCP's resvg and embedded Inter. A stored tab is drawn from the api's
`render.svg`, so the CLI and the MCP draw alike.

## One catalogue for the CLI and the MCP

Every command and every MCP tool is a projection of one **verb** in `@livediagram/agent-verbs`: its id
(`tab.view`, `element.set`), input and output schemas, a factual description, its behaviour (read, write,
destructive) and a handler calling the api through `@livediagram/api-client`. The MCP keeps its tool names and
schemas: each tool is its own verb, a command whose shape differs is another, and the two share handlers. A parity
test fails when a verb is exposed by neither, or a tool's schema drifts from its verb.

## Distribution

- npm package `livediagram`, one bundled ESM file plus the resvg wasm and font, Node 22 or later, run with
  `npx livediagram@latest` or installed. Published from CI with provenance, versioned on its own.
- Standalone binaries and a Homebrew tap may follow; a `curl | sh` installer is never offered.
- Once a day at most, after a command, it checks npm for a newer version and says so on stderr; never in CI, when
  stderr is not a terminal, or with `LIVEDIAGRAM_NO_UPDATE_CHECK=1`.

## Telemetry

- Category `Cli`, action `Used`, type the verb (`TabView`), sent after a command succeeds, never for help, mirroring
  `Mcp·Used` ([Telemetry](../017-telemetry/telemetry.md)). Api failures report as `Error·Api` with the verb, 4xx
  never.
- Sent to the active profile's api only. Off with `LIVEDIAGRAM_TELEMETRY=0`, `DO_NOT_TRACK=1` or `telemetry off`
  (which sends its own `UI·Toggled·TelemetryOff` first). The first run says on stderr what is counted.
- No device id, arguments, document ids or host names.
- A sign-in through the CLI counts as `Token·Created·Cli`, beside the MCP's `Token·Created·MCP`.

## Limits

| Constant                   | Value | Why                                                         |
| -------------------------- | ----- | ----------------------------------------------------------- |
| `HELP_TOP_MAX_TOKENS`      | 500   | Top-level help measured at 380; room to grow, not to sprawl |
| `HELP_RESOURCE_MAX_TOKENS` | 250   | A resource's verbs, a line each                             |
| `HELP_VERB_MAX_TOKENS`     | 400   | Usage, flags, two examples                                  |
