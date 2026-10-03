# CLI

**Status: specified, not built.**

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

## Commands

Resource, then verb. `doc` and `el` are accepted for `document` and `element`.

| Command                                                                | Does                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `document ls [query]`                                                  | Documents in the personal library and joined teams, newest first          |
| `document view <doc>`                                                  | The overview view                                                         |
| `document create <name> [--tab <name>] [-f <file>\|--template <kind>]` | A new document, from a graph, Mermaid or template                         |
| `document rename\|share\|rm\|restore <doc>`                            | As the MCP's verbs; `rm` moves to the Trash, there is no permanent delete |
| `tab ls <doc>`                                                         | The document's tabs                                                       |
| `tab view <doc> [--tab <t>] [--view <name>] [--budget <n>]`            | A view; the outline by default                                            |
| `tab add\|rename\|rm <doc> ...`                                        | Tab lifecycle; `add` takes `-f` or `--template`                           |
| `tab diff <doc> [--tab <t>] --since <rev>`                             | The diff view                                                             |
| `tab render <doc> [--tab <t>] --png <file>\|--svg <file>`              | A preview image; prints the path and its size, never image bytes          |
| `tab lint <doc> [--tab <t>]`                                           | The [diagram lint](../024-agents/diagram-lint.md)                         |
| `element add\|set\|rm\|move\|connect\|insert\|wrap <doc> ...`          | One [edit operation](../024-agents/edit-operations.md) as a changeset     |
| `changeset apply <doc> [--tab <t>] -f <file>\|-` (`edit`)              | Many edit operations, or a `replace`, as one changeset                    |
| `changeset ls\|show\|revert <doc> [<changeset>]`                       | Recent changesets and their revert                                        |
| `comment ls\|add\|reply\|resolve\|reopen <doc> ...`                    | Threads ([Agent presence](../024-agents/agent-presence.md#comments))      |
| `presence set\|clear <doc> [--tab <t>] [--status ..] [--focus ..]`     | The agent's presence                                                      |
| `wait <doc> --for mention\|comment\|change [--timeout <s>]`            | Blocks until it happens, prints it, exits                                 |
| `watch <doc>`                                                          | Streams changes, one line each, until interrupted                         |
| `graph lint\|render <file>`                                            | Lint or preview a graph or Mermaid file locally, before writing anything  |
| `pull <doc> [--to <dir>]` / `push <file>`                              | Sync one document to a file and back                                      |
| `export --all --to <dir> [--format json,svg,png,mermaid,md]`           | Every document to files                                                   |
| `template ls\|view`, `icon search <text>`, `schema [kind]`             | The catalogues and the element format, from the api                       |
| `guide [topic]`                                                        | How-tos: `build`, `edit`, `views`, `comments`, `collaborate`              |
| `skill print\|install [--to <dir>]`                                    | The agent skill file                                                      |
| `api <method> <path> [--body <file>\|-]`                               | Any api route, authenticated; the escape hatch                            |
| `auth login\|status\|logout`                                           | Credentials                                                               |

**Addressing.** `<doc>` is a document name, an id prefix, or a pasted livediagram URL; an ambiguous one is refused
with the candidates. `--tab` takes a tab name or id prefix and defaults to the first tab. Elements are
[refs and selectors](../024-agents/edit-operations.md#selectors).

**Writes** accept `--dry-run` (the plan, nothing written), `--summary <text>`, `--base <rev>` (defaults to the
revision of the agent's last view of that tab, cached locally), `--strict` and `--wait-held <seconds>`.

## Help

- `livediagram --help` lists the resources, how to address things, the output rules and four starting commands,
  within `HELP_TOP_MAX_TOKENS`.
- `<resource> --help` lists its verbs in a line each, within `HELP_RESOURCE_MAX_TOKENS`.
- `<resource> <verb> --help` gives usage, flags, two examples and what it prints, within `HELP_VERB_MAX_TOKENS`.
- `guide <topic>` and `schema <kind>` carry the depth, so it is paid for only when needed.
- `skill print` prints a `SKILL.md` whose frontmatter (about 60 tokens) says when to use the CLI and whose body
  points at `guide`. `skill install` writes it into an agent skills directory.
- Help, guide, schema and the skill come from the same verb catalogue, and tests hold each within its budget.

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
| 4    | Not signed in, or not permitted (`read_only_token`)              |
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
  do not run the MCP worker. The token is named "livediagram CLI", which is the agent name its work shows.
- Credentials go in the OS keychain when available, else `~/.config/livediagram/credentials.json` at mode 0600.
- `auth status` prints the host, account, token name, read-only flag and expiry, never the secret, and warns inside
  14 days of expiry. `auth logout` revokes the token and forgets it.
- A host without sign-in has no tokens, so the CLI cannot act there and says so in one line, as the MCP is absent
  there ([Public API and API tokens](public-api-and-tokens.md) §3.7).

## Profiles and self-hosting

- `~/.config/livediagram/config.toml` names profiles, each a `host`; `--host`, `--profile`, `LIVEDIAGRAM_HOST` and
  `LIVEDIAGRAM_PROFILE` choose one. The default is `https://livediagram.app`.
- The CLI learns a host from `GET /api/capabilities`: the api base, whether sign-in and the OAuth server exist, the
  document format and the oldest CLI version it accepts (`cli.minVersion`). Below that version the CLI refuses
  writes and names the version to install.
- A self-host profile never contacts livediagram.app.

## Local files

- `pull <doc>` writes `<slug>.livediagram.json`: the document, its tabs and each tab's revision. `--svg` adds a
  picture per tab.
- `push <file>` sends each changed tab as a changeset based on the pulled revision. A tab changed on the server
  since is refused as a conflict, naming it; the person pulls again. Nothing is overwritten blindly.
- `export --all` writes every document, read-only, for backups and docs.

## Previews

`tab render` and `graph render` draw with the shared SVG renderer (`renderElementsToSvg`) and rasterise PNGs with
`@livediagram/render-png`, the MCP's resvg and embedded Inter. A stored tab is drawn from the api's
`render.svg`, so the CLI and the MCP draw alike.

## One catalogue for the CLI and the MCP

Every command and every MCP tool is a projection of one **verb** in `@livediagram/agent-verbs`: its id
(`tab.view`, `element.set`), input and output schemas, a factual description, its behaviour (read, write,
destructive) and a handler calling the api through `@livediagram/api-client`. The MCP keeps its tool names; a
parity test fails when a verb is exposed by neither, or a tool's schema drifts from its verb.

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

## Limits

| Constant                   | Value | Why                                                         |
| -------------------------- | ----- | ----------------------------------------------------------- |
| `HELP_TOP_MAX_TOKENS`      | 500   | Top-level help measured at 380; room to grow, not to sprawl |
| `HELP_RESOURCE_MAX_TOKENS` | 250   | A resource's verbs, a line each                             |
| `HELP_VERB_MAX_TOKENS`     | 400   | Usage, flags, two examples                                  |
