# CLI: blueprint

Derived from [CLI](../cli.md), with the OAuth server of [MCP server](../mcp-server.md) §3 and its tool contracts
(§4), the token surface of [Public API and API tokens](../public-api-and-tokens.md) §3.4 to §3.7, the room and
routes of [API](../api.md), the token roles of [Share roles](../../013-workspace/share-roles.md#api-tokens), the
words of [Domain language](../../003-system-architecture/domain-language.md#agents) and the `Cli` category of
[Telemetry](../../017-telemetry/telemetry.md). The write path, the operation vocabulary, the views, the lint and
agent presence are other blueprints' and are consumed through the interfaces they name:
[Agent changesets](../../024-agents/blueprints/agent-changesets.md),
[Edit operations](../../024-agents/blueprints/edit-operations.md),
[Document views](../../024-agents/blueprints/document-views.md),
[Diagram lint](../../024-agents/blueprints/diagram-lint.md) and
[Agent presence](../../024-agents/blueprints/agent-presence.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`CLIn`.

Scope, by file:

| File                                                                                                        | Role                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/{package.json,tsconfig.json,eslint.config.js,vitest.config.ts}`                       | New private package `@livediagram/agent-verbs`, laid out like `packages/explorer-lens`; depends on zod 4                                                                                                                                                                                                                                            |
| `packages/agent-verbs/src/define.ts`                                                                        | `Verb`, `defineVerb`, `VerbBehaviour`, `VerbContext`, `CliProjection`                                                                                                                                                                                                                                                                               |
| `packages/agent-verbs/src/catalogue.ts`                                                                     | `VERBS`, `verbById`, `verbsOf`, `RESOURCES`, `RESOURCE_ALIASES`, `TOP_LEVEL`; `COMMAND_ALIASES` with `edit`                                                                                                                                                                                                                                         |
| `packages/agent-verbs/src/verbs/{document,tab,edit,lifecycle,changeset,comment,presence}.ts`                | The CLI's api verbs: schemas, descriptions, behaviour, handlers, compact text, CLI projections                                                                                                                                                                                                                                                      |
| `packages/agent-verbs/src/verbs/shared.ts`                                                                  | `columns`, `day`, `minute`, `documentOf`, `tabOf`, `tabPath`, the list limits                                                                                                                                                                                                                                                                       |
| `packages/agent-verbs/src/verbs/mcp-tools.ts` (+ test), `src/mcp/{schema,output-schema}.ts`                 | One verb per existing MCP tool, with today's schema and tool name                                                                                                                                                                                                                                                                                   |
| `packages/agent-verbs/src/verbs/catalogues.ts` (+ test)                                                     | `template.ls`, `template.view`, `icon.search`, `schema.view`; an unknown name refused with the nearest                                                                                                                                                                                                                                              |
| `packages/agent-verbs/src/verbs/local.ts`                                                                   | The CLI-only verbs, declared without `run` (CLI55)                                                                                                                                                                                                                                                                                                  |
| `packages/agent-verbs/src/addressing.ts`                                                                    | `parseDocumentUrl`, `resolveDocument`, `resolveTab`, `AddressError`, `AddressLog`                                                                                                                                                                                                                                                                   |
| `packages/agent-verbs/src/refs.ts`                                                                          | `REF_MIN_PREFIX`, `shortestUniquePrefixes`                                                                                                                                                                                                                                                                                                          |
| `packages/agent-verbs/src/source-kind.ts` (+ test)                                                          | `classifySource(text)`: what a `-f` file holds and the body it becomes (CLI71)                                                                                                                                                                                                                                                                      |
| `packages/agent-verbs/src/{argv-line,copies,write}.ts` (+ tests)                                            | `argvToOperationLine` (CLI23); `ReadCopies`, `baseFromCopy`, `readPlainTab`, `recordCopy`; `submitChangeset`, `writeFlags`                                                                                                                                                                                                                          |
| `packages/agent-verbs/src/verbs/edit.ts` (+ test)                                                           | `changeset.apply`, the seven `element.*` verbs, `tab.diff`                                                                                                                                                                                                                                                                                          |
| `packages/agent-verbs/src/verbs/lifecycle.ts` (+ test)                                                      | `document.create                                                                                                                                                                                                                                                                                                                                    | rename | share | rm  | restore`, `tab.add | rename | rm` |
| `apps/api/src/routes/document-seed.ts`                                                                      | `compileSeededTabs`: a create's graph, Mermaid or template tabs through `applyReplace`, and the intent of the first                                                                                                                                                                                                                                 |
| `packages/api-schema/src/document-source.ts` (+ test)                                                       | `DOCUMENT_SOURCES` (`ai`, `mcp`, `cli`), `isDocumentSource`, `isMadeByAiSource`                                                                                                                                                                                                                                                                     |
| `packages/agent-verbs/src/find-documents.ts` (+ test)                                                       | Moved from `apps/mcp`; gains `listAllDocuments(api)`                                                                                                                                                                                                                                                                                                |
| `packages/agent-verbs/src/guides/index.ts`                                                                  | `GUIDE_TOPICS`, `GUIDE_TOPIC_NAMES`, `isGuideTopic`, `GUIDE_TOPIC_MAX_TOKENS`: build, edit, views, comments, collaborate, workbench                                                                                                                                                                                                                 |
| `packages/agent-verbs/src/skill.ts`                                                                         | `SKILL_NAME`, `SKILL_DESCRIPTION`, `SKILL_DIRECTORIES`, `SKILL_FRONTMATTER_MAX_TOKENS`, `SKILL_BODY_MAX_TOKENS`, `renderSkill()`                                                                                                                                                                                                                    |
| `packages/agent-verbs/src/testing/fake-api.ts`                                                              | `fakeApi`, `contextOf` and the library fixtures the verb suites share                                                                                                                                                                                                                                                                               |
| `packages/api-client/package.json`, `packages/api-client/src/client.ts`, `packages/api-client/src/index.ts` | New package `@livediagram/api-client`: `createApiClient`, `ApiError`, `postEvents`, from `apps/mcp/src/api.ts`                                                                                                                                                                                                                                      |
| `packages/api-client/src/client.test.ts`                                                                    | Moved from the MCP's api suite, rewritten against the injected fetch                                                                                                                                                                                                                                                                                |
| `packages/render-png/{package.json,...}`, `src/index.ts` (+ test)                                           | New package `@livediagram/render-png`: `createPngRenderer`, from `apps/mcp/src/render.ts`                                                                                                                                                                                                                                                           |
| `packages/render-png/fonts/{Inter-Regular.ttf,Inter-OFL.txt}`                                               | `git mv` of `apps/mcp/fonts/*`                                                                                                                                                                                                                                                                                                                      |
| `packages/api-schema/src/index.ts`                                                                          | `CapabilitiesResponse` gains five fields; `CurrentTokenResponse`; the catalogue route bodies                                                                                                                                                                                                                                                        |
| `packages/api-schema/src/oauth-clients.ts` (+ test)                                                         | `CLI_CLIENT_ID`, `CLI_CLIENT_NAME`, `CLI_REDIRECT_URIS`, `DEVICE_CODE_GRANT`, user-code helpers                                                                                                                                                                                                                                                     |
| `packages/api-schema/src/api-token-format.ts` (+ test)                                                      | `API_TOKEN_PREFIX`, `isApiTokenFormat`, moved from `apps/api/src/auth/api-token.ts` (CLI63)                                                                                                                                                                                                                                                         |
| `packages/api-schema/src/telemetry-schema.ts`                                                               | Category `Cli`                                                                                                                                                                                                                                                                                                                                      |
| `packages/licences/src/apps.ts`                                                                             | `DISTRIBUTED_APPS` names `cli`: its package carries its own notices                                                                                                                                                                                                                                                                                 |
| `packages/document/src/document-envelope.ts`, `export-tab-text.ts` (+ tests)                                | Moved (`git mv`) from the editor's `lib/` (CLI64)                                                                                                                                                                                                                                                                                                   |
| `packages/edit-operations/src/element-format.ts` (+ test)                                                   | `elementKindsText()`, `elementFormatText(kind)`, `addableKinds()`, `SHAPE_COMMON_FIELDS`, `SHAPE_KIND_FIELDS` (CLI73)                                                                                                                                                                                                                               |
| `packages/icons/src/{search-rank,search}.ts` (+ test)                                                       | `matches`, `paletteRank` moved from `apps/live/lib/search.ts`; `searchIcons(query, limit)` on the `./search` subpath (CLI74)                                                                                                                                                                                                                        |
| `packages/templates/src/template-catalogue.ts` (+ test)                                                     | `templateCatalogue()`, shared by the MCP's `list_templates` and `GET /api/templates`                                                                                                                                                                                                                                                                |
| `apps/cli/{package.json,tsconfig.json,eslint.config.js,vitest.config.ts,README.md}`                         | New app `@livediagram/cli`, published as `@livediagram/cli`, command `livediagram` (CLI1)                                                                                                                                                                                                                                                           |
| `apps/cli/scripts/build.mjs`, `apps/cli/PACKAGE_README.md`                                                  | esbuild bundle `dist/livediagram.mjs`; `dist/package.json` named `@livediagram/cli`, `LICENSE`, the user README, `THIRD_PARTY_LICENSES` from the metafile and the licences page's embedded works; `resvg.wasm`, `Inter-Regular.ttf` and `Inter-OFL.txt` beside the bundle (CLI31); a bundled package without a licence fails the build (CLI1, CLI2) |
| `apps/cli/src/bin.ts`, `main.ts`, `io.ts`, `node-io.ts`                                                     | Process wiring; `run(argv, io): Promise<ExitCode>`; `CliIo` (with `openSocket`, `timer`, `onInterrupt` for the room stream, `stdoutIsTTY` for `workbench pair`); the real `nodeIo()`                                                                                                                                                                |
| `apps/cli/src/{debug,transport}.ts`                                                                         | `debugLog` (CLI44); the api client per token with the CLI's headers and share code (CLI45)                                                                                                                                                                                                                                                          |
| `apps/cli/src/testing/fake-io.ts`                                                                           | `fakeIo`, the in-memory `CliIo` every suite runs on                                                                                                                                                                                                                                                                                                 |
| `apps/cli/src/dispatch/{route,parse-flags,globals,fields,did-you-mean}.ts`                                  | Resource and verb routing, `parseArgs` options from each verb's input (`fieldsOf`, `flagOf`), global flags, suggestions                                                                                                                                                                                                                             |
| `apps/cli/src/help/help.ts`                                                                                 | `topHelp`, `resourceHelp`, `verbHelp` and their token budgets                                                                                                                                                                                                                                                                                       |
| `apps/cli/src/output/{exit-codes,cli-error,failure-of,print}.ts`                                            | `EXIT`, `exitCodeForStatus`, `CliError`, `formatError`, `failureOf`, `render` with `--json` fields                                                                                                                                                                                                                                                  |
| `apps/cli/src/config/{paths,config-file,profiles,capabilities,version}.ts`                                  | Directories, `config.toml`, profile choice, the capabilities cache, `CLI_VERSION`, the version floor                                                                                                                                                                                                                                                |
| `apps/cli/src/auth/credentials.ts`                                                                          | The 0600 file store; env before stored (`resolveCredential`, `storedCredential`)                                                                                                                                                                                                                                                                    |
| `apps/cli/src/auth/keychain.ts` (+ test)                                                                    | The platform's store through its own tool: `security`, `secret-tool`, PowerShell DPAPI (CLI4)                                                                                                                                                                                                                                                       |
| `apps/cli/src/auth/{oauth-client,loopback-login,device-login,token-login}.ts`                               | The three ways in                                                                                                                                                                                                                                                                                                                                   |
| `apps/cli/src/auth/{open-browser,callback-page}.ts`                                                         | Browser opener; the loopback page's HTML                                                                                                                                                                                                                                                                                                            |
| `apps/cli/src/commands/local.ts`                                                                            | Handlers of the local verbs `guide`, `skill`, `api` and `auth`                                                                                                                                                                                                                                                                                      |
| `apps/cli/src/commands/*.ts`                                                                                | Handlers of `pull`, `push`, `export`, `render`, `graph`, `diff`, `wait`, `watch`, `telemetry`                                                                                                                                                                                                                                                       |
| `apps/cli/src/sync/{pull-file,read-copies}.ts`                                                              | The pull file; the read copies that give the base and the diff                                                                                                                                                                                                                                                                                      |
| `apps/cli/src/room/{room-stream,room-events}.ts`                                                            | Ticket, socket, reconnect; op classification and lines                                                                                                                                                                                                                                                                                              |
| `apps/cli/src/render/png.ts`, `apps/cli/src/commands/render.ts`                                             | The Node loaders for `@livediagram/render-png`                                                                                                                                                                                                                                                                                                      |
| `apps/cli/src/telemetry.ts` (+ test)                                                                        | `sendCliUsed`, `reportApiFailure`, `telemetryOffReason`, `setTelemetry`, the notice once (`state.json`)                                                                                                                                                                                                                                             |
| `apps/cli/src/update-check.ts` (planned)                                                                    | The npm check                                                                                                                                                                                                                                                                                                                                       |
| `apps/telemetry/app/cli-commands.ts`, `apps/telemetry/app/catalogue/cli-commands.ts`                        | `CLI_COMMANDS` (one row a counted verb), `cliCommandSentence`; the CLI Commands stack (CLI56)                                                                                                                                                                                                                                                       |
| `apps/api/src/routes/capabilities.ts`, `types.ts`, `wrangler.toml`                                          | `apiBase`, `authEnabled`, `oauthIssuer`, `documentFormat`, `cli`; vars `OAUTH_ISSUER`, `CLI_MIN_VERSION` (CLI10)                                                                                                                                                                                                                                    |
| `apps/api/src/routes/tokens.ts`                                                                             | `GET` and `DELETE /api/tokens/current`, reading the token's row from `listApiTokensByOwner`                                                                                                                                                                                                                                                         |
| `apps/api/src/routes/catalogues.ts` (+ test), `index.ts`                                                    | `GET /api/templates[/:kind]`, `/api/icons`, `/api/schema[/:kind]`; dispatch of the three segments                                                                                                                                                                                                                                                   |
| `apps/api/src/index.ts`                                                                                     | The token write choke point admits `DELETE /api/tokens/current` and the room-ticket mint                                                                                                                                                                                                                                                            |
| `apps/api/src/openapi/{manifest,document}.ts`                                                               | The capabilities fields; `tokens/current`; the catalogue routes                                                                                                                                                                                                                                                                                     |
| `apps/mcp/src/api.ts`, `render.ts`, `image-result.ts`                                                       | Wiring of the extracted packages; the schema resource reads `elementSchemaDoc` from `@livediagram/document`                                                                                                                                                                                                                                         |
| `apps/mcp/src/oauth.ts`, `oauth-clients.ts`, `oauth-device.ts` (+ tests)                                    | Port-agnostic loopback, the built-in CLI client, the device grant; the session lookup returns `clientId`                                                                                                                                                                                                                                            |
| `apps/mcp/src/tools.ts`, `tool-annotations.ts`, `verb-parity.test.ts`                                       | Each tool registered from its verb in `mcp-tools.ts`; the parity test                                                                                                                                                                                                                                                                               |
| `apps/live/app/oauth/oauth-shell.tsx`, `apps/live/app/oauth/consent/page.tsx`                               | `OauthShell` and `OauthHelpLink` lifted out of the consent page; `Token·Created·Cli` for the CLI client                                                                                                                                                                                                                                             |
| `apps/live/lib/mcp-consent-session.ts`                                                                      | `McpConsentSession` gains `clientId`                                                                                                                                                                                                                                                                                                                |
| `apps/live/app/oauth/device/page.tsx`, `apps/live/lib/mcp-device-session.ts` (+ test)                       | The `/oauth/device` page and its trust boundary                                                                                                                                                                                                                                                                                                     |
| `apps/live/lib/export-tab.ts`, the envelope's callers, `lib/search.ts`                                      | Import the moved modules from `@livediagram/document` and `@livediagram/icons`                                                                                                                                                                                                                                                                      |
| `apps/telemetry/app/catalogue/connections.ts`, `computed-emitters.ts`, `event-explanations.ts`              | The `CLI Commands` stack, `CLI Sign-Ins` in API Token Activity, the computed sites, the sentences (CLI56)                                                                                                                                                                                                                                           |
| `.github/workflows/ci.yml`, `.github/workflows/cli-publish.yml`                                             | Pack dry run on every PR; publish with provenance (CLI3)                                                                                                                                                                                                                                                                                            |
| `README.md`, `docs/development/{architecture,local-development}.md`, `docs/operations/self-hosting.md`      | The app, the packages, the two api vars, the CLI on a self-host, the env token's host; `AGENTS.md`'s layout needs the operator's permission                                                                                                                                                                                                         |

## Domain and naming

| Term                | Identifier                                                              | Meaning                                                                  |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Verb                | `Verb`, id `<resource>.<verb>` (`tab.view`)                             | One capability; a command and a tool are its projections                 |
| Command             | `livediagram <resource> <verb>`                                         | The CLI's front door to a verb                                           |
| Tool                | the MCP's snake_case name                                               | The MCP's front door to a verb                                           |
| Resource            | `RESOURCES` entry (`document`, `tab`, ...)                              | The first word; `doc` and `el` are its aliases                           |
| Behaviour           | `VerbBehaviour`: `read`, `write`, `destructive`                         | As the MCP's `ToolBehaviour`, which becomes an alias of it               |
| Local verb          | `Verb.local: true`                                                      | A verb whose handler needs Node and lives in `apps/cli/src/commands`     |
| Profile             | `Profile { name, host }`                                                | A named host in `config.toml`                                            |
| Host                | `Profile.host`                                                          | The origin a profile talks to (`https://livediagram.app`)                |
| Api base            | `Capabilities.apiBase`                                                  | Where the api answers for that host                                      |
| Capabilities        | `CapabilitiesResponse`, `loadCapabilities`                              | What a host offers, from `GET /api/capabilities`                         |
| Credential          | `StoredCredential`, `CredentialSource` (`env`, `keychain`, `file`)      | The `lvd_` token the CLI presents, and where it came from                |
| Version floor       | `cli.minVersion`, `isBelow`                                             | The oldest CLI a host accepts writes from                                |
| Read copy           | `ReadCopy`, `ReadCopies`, `recordCopy`, `baseFromCopy`                  | The plain tab as the CLI last read it at one revision                    |
| Base                | `baseFromCopy(copy)` → `ChangesetBase`                                  | A read copy's revision and every element's fingerprint, sent with writes |
| Source kind         | `SourceKind`: `graph`, `mermaid`, `elements`, `replace`, `operations`   | What a `-f` file holds                                                   |
| Pull file           | `PullFile`, `<slug>.livediagram.json`                                   | One document on disk, with each tab's revision                           |
| Preview             | `tab render`, `graph render`                                            | A PNG or SVG file of a tab or a graph                                    |
| Loopback login      | `loginWithBrowser`                                                      | OAuth with PKCE and a `127.0.0.1` redirect                               |
| Device login        | `loginWithDevice`, `DeviceGrant`                                        | The RFC 8628 grant; the person approves at `/oauth/device`               |
| User code           | `userCode`, `formatUserCode`, `normaliseUserCode`                       | The 8-letter code the person types                                       |
| Built-in CLI client | `CLI_CLIENT_ID` `livediagram-cli`, `CLI_CLIENT_NAME` `livediagram CLI`  | The public client the server vouches for                                 |
| Room stream         | `openRoomStream`                                                        | The CLI's listening socket for `wait` and `watch`                        |
| Guide topic         | `GUIDE_TOPICS` key: `build`, `edit`, `comments`, ..., `workbench` (six) | One how-to                                                               |
| Skill               | `renderSkill()`, `SKILL.md`                                             | The agent skill file                                                     |
| Exit code           | `EXIT` (`done` 0 to `failure` 7)                                        | The process status, one of eight                                         |

Banned: "subcommand" (a verb), "context" or "workspace" for a profile, "PAT" or "login token" (an API token),
"diagram" or "board" for a document, "op" for an edit operation (that is a room `ElementOp`), "batch", "patch" or
"commit" for a changeset, "mode" or "format" for a view, "handle" for a ref, "query" or "filter" for a selector,
"bot" for an agent, "plugin", "snapshot" for a read copy (that is a document's SVG snapshot), "whole-tab save" for
anything the CLI does.

## Behaviour and state

### One command, start to end (`run`)

1. **Route.** `route(words)`, after `splitGlobals(argv)`, reads the first words: a resource (or alias) and a verb, or a top-level
   command (`wait`, `watch`, `pull`, `push`, `export`, `guide`, `api`, `edit`). Unknown words exit 2 with
   suggestions (CLI51). `--help` or `-h` anywhere prints the help of the deepest level routed and exits 0; `--version`
   prints `CLI_VERSION` and exits 0. Neither sends telemetry.
2. **Parse.** `parseVerbArgs(verb, rest)` runs `node:util` `parseArgs` (`strict: true`, `allowPositionals: true`)
   with the global flags plus the options `buildParseOptions(verb)` generates, maps positionals by the verb's
   `cli.positionals`, then validates with `verb.input.safeParse`. Failures exit 2 or 1 (CLI15).
3. **Profile.** `resolveProfile(flags, env, config)` (CLI7).
4. **Credential.** `resolveCredential(profile, env, store)`: `LIVEDIAGRAM_TOKEN` when set and non-empty, else the
   profile's stored credential, else none. Verbs that need no credential (`guide`, `skill`, `graph`, `telemetry`,
   `auth login`, and every read of a pull file) run without one; every other verb exits 4.
5. **Capabilities.** `loadCapabilities(profile)` from the cache or `GET {host}/api/capabilities` (CLI8). An absent
   `authEnabled` or `authEnabled: false` makes every api verb exit 4 with the "no sign-in" line: the CLI does not act
   as a guest.
6. **Floor.** `isBelow(CLI_VERSION, caps.minVersion)` in `runOnline`: a verb whose behaviour is `write` or `destructive` and that reaches the
   api, below `cli.minVersion`, exits 1 (CLI13). Reads are never refused. A host `documentFormat` above the
   bundled `DOCUMENT_FORMAT` refuses the verbs marked `files` (`pull`, `push`, `export`, `tab diff`, reads of a pull
   file) with exit 1 and the version to install; online commands carry on. `graph` is offline and knows no host.
7. **Address.** `<doc>` and `--tab` resolve through `resolveDocument` and `resolveTab` (below); elements are left to
   the api, except the comment verbs' ref (below).
8. **Run.** The handler calls the api through the client and returns the verb's output object.
9. **Print.** `print(verb, output, mode)` writes the text, JSON or quiet form to stdout.
10. **After.** `sendCliUsed` (awaited at most `TELEMETRY_FLUSH_TIMEOUT_MS`) and the update notice, both skipped on a
    non-zero exit; the process exits with the code.

Invariants:

- **I1** stdout carries data only: a verb's output, a list's footer line, the empty-list line, `wait`'s timeout
  line. Every hint, warning, error, notice and progress line goes to stderr.
- **I2** The CLI never prompts. It reads stdin only for `-` file arguments, `--body -` and `auth login --with-token`
  (CLI66).
- **I3** No secret reaches stdout, stderr or a debug line: `Authorization` is printed as `Bearer lvd_…`, tokens never.
- **I4** The CLI never does a whole-tab save. Element and tab content is written by changesets (a new tab is a
  `replace` changeset on a new tab id), a tab's name by `PUT .../tabs/:tabId/name`, a new document by
  `POST /api/documents` compiling its tabs. `api` refuses `PUT /documents/:id/tabs/:tabId` locally (exit 2), and the
  api would answer a token's tab `PUT` `405 use_changesets` regardless.
- **I5** A profile contacts its own host and nothing else, except the npm update check.
- **I6** The exit code is one of `EXIT`'s eight.
- **I7** `Cli·Used` is sent only after a command that exited 0, never for help.

### Addressing

`resolveDocument(api, input, host, log)`, in order, the union of matches deciding (`document restore` adds the
Trash):

| Input                                            | Resolves to                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| A path ending in `.livediagram.json` that exists | That pull file, read-only: `document view`, `tab ls` and `tab view` render with `renderView` locally; any other verb exits 2 (CLI70) |
| A URL whose path is `/document/<id>`             | That id, after `parseDocumentUrl`; another origin than the host exits 2 (CLI21)                                                      |
| A URL whose path is `/document/shared?s=<code>`  | The document of `GET /api/share/<code>`; every request of the command carries `X-Share-Code: <code>`                                 |
| A full id (a 36-character UUID)                  | `GET /api/documents/<id>` directly, no list                                                                                          |
| Anything else                                    | The swept list: ids starting with it (at least 4 characters) and names equal to it ignoring case (CLI20)                             |

The swept list is `listAllDocuments(api)`: `GET /api/documents`, `GET /api/teams`, `GET /api/teams/:id/library`
each, as `find_documents` sweeps; a team failure degrades to personal, as today. `document restore` resolves against
`GET /api/trash` instead. One match proceeds; none exits 3 with the nearest names; several exit 3 with the
candidates. A share link's password is not sent: a password-protected link answers as the api does, exit 4.

`resolveTab(document, input)`: absent is the first tab by `orderIndex`; else the tab whose name equals it ignoring
case, or whose id starts with it (at least 4 characters) (CLI22). None or several exit 3 with the tab list.

Comment verbs take an element ref, resolved with `resolveRef` from `@livediagram/document` (`element-refs.ts`)
over the plain tab: not found or ambiguous exits 3 with the candidates `resolveRef` names. `reply`, `resolve` and
`reopen` act on the thread on that element through its last comment's id; an element with no thread exits 3
(`no thread on <ref>`) (CLI78).

### Writes

Changeset writes (`element *`, `changeset apply`, `tab add`, `push`) take the write flags `--dry-run`,
`--summary`, `--base`, `--strict` and `--wait-held`; no other write takes them.

1. Build the body. Element verbs turn their words into one line-form operation with `argvToOperationLine` (CLI23)
   and parse it locally with `parseEditOperations`. `changeset apply` reads `-f <file>` or stdin and classifies it
   with `classifySource` (CLI71): `operations` sends `{ operations }` (line or JSON form), `replace`, `graph`,
   `mermaid` and `elements` send `{ replace: { … } }`; an unrecognised file exits 1 ("can't tell what <file> holds:
   expected edit operations, a graph, Mermaid or elements").
2. Base: `--base <rev>` sends `{ rev }` with the fingerprints of the read copy at that revision when one exists;
   otherwise the latest read copy's `baseFromCopy`: `{ rev, elements }`, `elements` holding `elementFingerprint`
   (which leaves out `LIVE_ELEMENT_FIELDS`) of every element. The api checks the fingerprints of its `targets` only.
   No copy sends no base, and the api's `no_base` warning prints to stderr.
3. `POST {apiBase}/documents/:id/tabs/:tabId/changesets[?dryRun=1]` with `{ operations | replace, base, strict,
summary }`.
4. On `409 elements_held` with `--wait-held <s>`: retry every `HELD_RETRY_INTERVAL_MS` until `s` seconds have
   passed since the first attempt, then exit 5 (CLI25).
5. Print the api's `text`: the result lines, then the footer `formatResultFooter` wrote, carrying the revert command
   `livediagram changeset revert <documentId> <changeset-id>` (CLI26); a dry run carries the engine's dry-run footer.
   Each of `warnings` prints to stderr.
6. When the write landed with `rebasedOver` 0, read the plain tab and `recordCopy` it (CLI24); a rebased write keeps
   the older copy, so a later write over someone else's change conflicts rather than passes.

### Credentials

| From   | Event                                                   | To               | Effect                                                                                                                                                |
| ------ | ------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| none   | `auth login`, browser approves                          | stored           | `loginWithBrowser`; `GET /api/tokens/current` verifies; stored                                                                                        |
| none   | `auth login --device`, person approves                  | stored           | `loginWithDevice`; verified; stored                                                                                                                   |
| none   | `auth login --with-token`                               | stored           | stdin read, `isApiTokenFormat`, verified; stored                                                                                                      |
| stored | any login succeeds                                      | stored (new)     | the replaced token is revoked with `DELETE /api/tokens/current` after the new one verifies; a failed revoke warns on stderr                           |
| stored | `auth logout`                                           | none             | `DELETE /api/tokens/current`, then forgotten; a 401 forgets too (CLI38)                                                                               |
| stored | `auth logout`, network failure                          | stored           | kept; exit 7                                                                                                                                          |
| env    | `auth logout`                                           | env              | exit 2: the env token is not the CLI's to revoke (CLI38)                                                                                              |
| stored | api answers 401, the store holds a different token      | stored (re-read) | `transport.forCredential` re-reads the store (`resolveCredential`), retries the refused request once with the new token; debug `credential refreshed` |
| any    | api answers 401 (env token, store unchanged or emptied) | same             | exit 4 with `livediagram auth login`                                                                                                                  |

`auth status` warns on stderr when `expiresAt - now < TOKEN_EXPIRY_WARN_DAYS` days.

### The device grant (server, `oauth-device.ts`)

| From     | Event                                            | To       | Effect                                                         |
| -------- | ------------------------------------------------ | -------- | -------------------------------------------------------------- |
| absent   | `POST /oauth/device_authorization`               | pending  | `device:<deviceCode>` and `usercode:<userCode>`, TTL 600 s     |
| pending  | `POST /oauth/token` before `interval` has passed | pending  | `slow_down`; the stored interval grows by `DEVICE_SLOW_DOWN_S` |
| pending  | `POST /oauth/token`                              | pending  | `authorization_pending`; `lastPolledAt` stored                 |
| pending  | `POST /oauth/device/complete`                    | approved | token and expiry stored; `usercode:` deleted                   |
| pending  | `POST /oauth/device/deny`                        | denied   | `usercode:` deleted                                            |
| approved | `POST /oauth/token`                              | absent   | `{ access_token, token_type, expires_in }`; record deleted     |
| denied   | `POST /oauth/token`                              | absent   | `access_denied`; record deleted                                |
| any      | TTL passes                                       | absent   | `expired_token` on the next poll                               |

### The room stream (`wait`, `watch`)

| From         | Event                                          | To           | Effect                                                                                                                                          |
| ------------ | ---------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| idle         | start                                          | connecting   | `POST .../room-ticket`; `new WebSocket(<ws base>/documents/:id/ws?t=<ticket>)`                                                                  |
| connecting   | open                                           | open         | nothing sent, ever: no `hello`, so it is no session (CLI32)                                                                                     |
| open         | `op` frame                                     | open         | `classifyRoomOp`; `wait` may finish, `watch` prints a line                                                                                      |
| open         | close 4004                                     | stopped      | exit 3, "the document was moved to the Trash"                                                                                                   |
| open         | other close or error                           | reconnecting | stderr `reconnecting…`; backoff `ROOM_RECONNECT_MIN_MS` doubling to `ROOM_RECONNECT_MAX_MS`                                                     |
| reconnecting | reopened                                       | open         | stderr names the `tab diff` that shows what was missed                                                                                          |
| connecting   | ticket answered `429`                          | reconnecting | retried with the backoff, never final; any other status below 500 ends the stream                                                               |
| any          | SIGINT or SIGTERM, `--timeout`, a `wait` match | stopped      | socket closed with 1000; exit as below; `bin.ts` exits `EXIT_GRACE_MS` (250) after the command resolves, whatever a closing socket still awaits |

- `wait --for comment` finishes at the first `el-delta` whose delta kind is a comment add.
- `wait --for change` finishes after the first mutation-class or `changeset` op that is not a comment delta, once
  `WAIT_SETTLE_MS` passes without another, so a burst of edits is one change.
- Ops on other tabs count unless `--tab` is given.
- `--timeout` passing prints `nothing new in <n> s` on stdout and exits 0; SIGINT ends `wait` with exit 1 and
  `watch` with exit 0, both after closing the socket.
- The room-ticket mint is outside the token write choke point, so a token of any role opens the stream; the room
  then delivers what the ticket's role admits.

### Read copies

- `recordCopy(profile, documentId, tab, rev)` runs after every `tab view` (the view and the plain tab are read in
  parallel; their `ETag` revisions must agree, else the plain read repeats once, else no copy is kept), `tab view
--raw`, `tab diff`, `pull`, and a write with `rebasedOver` 0.
- Copies are keyed `<profile>|<documentId>|<tabId>`, at most `READ_COPY_REVS_PER_TAB` revisions each and
  `READ_COPY_MAX_BYTES` in all, evicted least recently used (CLI24, CLI76).
- `tab diff <doc> [--tab] --since <rev>`: the read copy at `<rev>` is `before`; the plain tab read now is `after`;
  `diffView(before, after, context)` from `@livediagram/document-views` prints, and `after` is recorded. No copy at
  `<rev>` exits 3 (`no copy of rev <rev>; tab diff compares against a revision this CLI has read`) naming the
  revisions it holds (CLI79). The api serves no diff view.

### Pull and push

- `pull <doc> [--to <dir>] [--svg]`: `documentOf` (a share link's code applies), then each tab with its `ETag`, in
  order; writes the pull file (CLI27) atomically (temporary file then rename) and records each tab's read copy; a tab
  answered without a revision exits 7. `--svg` adds `<slug>.<tab-slug>.svg` per tab from
  `GET .../tabs/:tabId/render.svg` (`apps/api/src/routes/tab-render-route.ts`, `renderTabSvg` in
  `apps/api/src/thumbnail.ts`), two tabs of one name told apart by `-<id8>`.
- `push <file>`: parses the pull file (`parsePullFile`), refuses another host than the profile's (exit 2); for each
  tab whose elements hash (`tabHashes`) differs from the pulled one, submits `replace { elements }` with
  `base { rev }` (the tab's pulled revision) and `strict: true`; a tab missing from the document, or from `livediagramSync`, is created
  by `replace { elements, name }` with no base (`WriteFlags.base: null`); a `412 stale_tab` prints
  `! stale tab "<name>"` and moves on; finally rewrites the file's revisions and hashes for the tabs that landed, and
  writes nothing on `--dry-run` (CLI28). An answer of `nothing changed` keeps the pulled revision.
- Only elements travel. A tab whose other fields (name, theme, background) changed, and a tab the file no longer
  holds, are each named on stderr as `not pushed: <what>`; nothing on the server is deleted.
- Exit: 0 when every changed tab landed, 5 when any was refused as stale, else the highest other code (CLI83).

### Previews

- `tab render`: `GET .../tabs/:tabId/render.svg`; `--svg <file>` writes it; `--png <file>` rasterises it with
  `@livediagram/render-png` at scale 1 (CLI30). Prints `<path>  <width>×<height> · <size>`, never bytes.
- `graph render <file>`: reads graph JSON or Mermaid (`graphOfSource`), lays it out with `lintGraph`'s elements (the
  layout `create_document` uses), then `renderElementsToSvg` with `resolveIconExportArt` and `resolveStickerArt`;
  nothing reaches the api. An offline verb.
- `export --format png` rasterises each tab's `render.svg` the same way. The render handlers and the renderer are
  imported dynamically, so other commands never evaluate them.
- `graph lint <file> [--compare <variants>]`: the same tab through `@livediagram/diagram-lint` (`graphLint` in
  `packages/agent-verbs/src/verbs/graph.ts`: a graph or Mermaid file, validated by `graphBodyIssue`); an `offline` verb.

## Interfaces and contracts

### The verb

```ts
type VerbBehaviour = 'read' | 'write' | 'destructive';

type Verb<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> = {
  id: `${string}.${string}` | string; // 'tab.view', or a top-level verb: 'guide', 'api'
  summary: string; // one line, a fact; the resource help's line
  description: string; // facts only (MCP §4.15); the verb help's first paragraph
  behaviour: VerbBehaviour;
  input: I;
  output: O;
  local?: true; // handler supplied by apps/cli (CLI55)
  run?: (ctx: VerbContext, input: z.infer<I>) => Promise<z.infer<O>>;
  text?: (output: z.infer<O>) => string[]; // compact lines; absent prints JSON
  json?: (output: z.infer<O>) => unknown; // what --json prints when not the output itself (a view's JSON)
  quiet?: (output: z.infer<O>) => string[]; // -q: refs or ids
  exitCode?: (output: z.infer<O>) => number; // a non-zero exit that is no error: the lint's errors exit 1
  listKey?: string; // the array a list verb returns, for --json fields and the footer
  cli?: CliProjection;
  mcp?: { tool: string }; // the tool name the MCP keeps
};

type CliProjection = {
  positionals: string[]; // input keys in order; a trailing '...words' takes the rest
  flags?: Record<string, { name?: string; short?: string; hidden?: true }>; // input key -> flag
  examples: [string, string]; // two runnable invocations
  prints: string; // one line: what stdout holds
};

type VerbContext = {
  api: ApiClient;
  host: string; // the profile's host, for links and messages
  useShareCode: (code: string) => void; // a pasted share link's code rides every later request
  log: (line: string) => void; // a debug line, printed under LIVEDIAGRAM_DEBUG=1
  notice: (line: string) => void; // a line beside the output: stderr in the CLI
  now: () => number;
  sleep: (ms: number) => Promise<void>; // --wait-held
  readInput: (path: string) => Promise<string>; // -f <file>, or stdin for -
  copies: ReadCopies | null; // the read copies; null where the front door keeps none
};
```

A verb words a refusal the api cannot (which tab to re-read) as `VerbRefusal { status, code, message, lines, hint }`;
the CLI exits on its `status` as on the api's.

```ts

```

Verbs and tools: each MCP tool is its own verb in `mcp-tools.ts`, holding today's tool name, input and output
schemas (`documentId`, `tabId`, `mode`, ...), and the CLI's commands are their own verbs. Where a tool and a command
do the same work they share handler helpers (`listAllDocuments`, `resolveDocument`, the api calls), never schemas.
A verb with `mcp` and no `cli` is MCP-only (`read_document`, `list_trash`); with `cli` and no `mcp`, CLI-only.

`buildParseOptions(verb)`: each input key not in `positionals` becomes `--<kebab-case key>` unless renamed; zod
string, enum and number become `type: 'string'` (numbers coerced by zod), boolean `type: 'boolean'`, arrays
`multiple: true`. Global flags:

| Flag               | Meaning                                             |
| ------------------ | --------------------------------------------------- |
| `--host <url>`     | Choose the host (CLI7)                              |
| `--profile <name>` | Choose the profile                                  |
| `--json [fields]`  | The output as JSON; fields pick keys (CLI17, CLI18) |
| `-q`, `--quiet`    | Refs or ids only                                    |
| `-h`, `--help`     | Help for the routed level                           |
| `--version`        | The CLI's version                                   |

There is no `--token` flag; `parseArgs` refuses it as unknown (exit 2).

### Commands

Positionals in `<>`, optional in `[]`. `<doc>` and `--tab` resolve as above. "Write flags" are `--dry-run`,
`--summary <text>`, `--base <rev>`, `--strict`, `--wait-held <seconds>`. Exit codes beyond 0 and 2 follow
`exitCodeForStatus` (CLI14).

| Command                                                                                                                                 | Verb               | Api                                                                                                                                        | stdout                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `document ls [query] [--limit n]`                                                                                                       | `document.ls`      | the sweep                                                                                                                                  | `<ref>  "<name>"  <library>  <YYYY-MM-DD>` (CLI60)                                                  |
| `document view <doc>`                                                                                                                   | `document.view`    | `GET /documents/:id?view=overview`                                                                                                         | the overview view                                                                                   |
| `document create <name> [--tab <name>] [-f <file>\|--template <kind>]`                                                                  | `document.create`  | `POST /documents { id, name, source: 'cli', tabs: [{ id, name, graph \| mermaid \| template \| elements }] }`, compiled by the api (CLI75) | `+ document <ref> "<name>" · <n> tabs · <url>`                                                      |
| `document rename <doc> <name>`                                                                                                          | `document.rename`  | `PUT /documents/:id { name }`                                                                                                              | `~ document <ref> "<old>"→"<new>"`                                                                  |
| `document share <doc> [--role <r>] [--expiry <e>]`                                                                                      | `document.share`   | `POST /documents/:id/share`; values and defaults of `share_document`                                                                       | the link URL                                                                                        |
| `document rm <doc>`                                                                                                                     | `document.rm`      | `DELETE /documents/:id`                                                                                                                    | `- document <ref> "<name>" · in the Trash for 30 days · restore: livediagram document restore <id>` |
| `document restore <doc>`                                                                                                                | `document.restore` | `POST /trash/:id/restore`                                                                                                                  | `+ document <ref> "<name>" restored`                                                                |
| `tab ls <doc>`                                                                                                                          | `tab.ls`           | `GET /documents/:id`                                                                                                                       | `<n>  <ref>  "<name>"` per tab (CLI59)                                                              |
| `tab view <doc> [--tab] [--view <name>] [--ref <ref>] [--text <text>] [--budget n] [--only <ref>] [--coarse] [--style] [--all] [--raw]` | `tab.view`         | `GET .../tabs/:tabId?view=…` (CLI69); `--raw` the plain tab                                                                                | the view as served                                                                                  |
| `tab add <doc> <name> [-f <file>\|--template <kind>]` + write flags                                                                     | `tab.add`          | changeset `replace` on a new tab id (CLI58)                                                                                                | result lines and footer                                                                             |
| `tab rename <doc> <tab> <name>`                                                                                                         | `tab.rename`       | `PUT /documents/:id/tabs/:tabId/name { name }`                                                                                             | `~ tab <ref> "<old>"→"<new>"`                                                                       |
| `tab rm <doc> <tab>`                                                                                                                    | `tab.rm`           | `DELETE /documents/:id/tabs/:tabId`                                                                                                        | `- tab <ref> "<name>"`                                                                              |
| `tab diff <doc> [--tab] --since <rev>`                                                                                                  | `tab.diff`         | the plain tab; the diff is computed locally                                                                                                | the diff view                                                                                       |
| `tab render <doc> [--tab] --png <file>\|--svg <file>`                                                                                   | `tab.render`       | `GET .../render.svg`                                                                                                                       | `<path>  <w>×<h> · <size>`                                                                          |
| `tab lint <doc> [--tab]`                                                                                                                | `tab.lint`         | `GET .../tabs/:tabId?view=lint`                                                                                                            | the lint output                                                                                     |
| `element add\|set\|rm\|move\|connect\|insert\|wrap <doc> [--tab] <words…>` + write flags                                                | `element.<op>`     | the changeset route                                                                                                                        | result lines and footer                                                                             |
| `changeset apply <doc> [--tab] -f <file>\|-` + write flags (`edit`)                                                                     | `changeset.apply`  | the changeset route                                                                                                                        | result lines and footer                                                                             |
| `changeset ls <doc> [--tab] [--limit n]`                                                                                                | `changeset.ls`     | `GET /documents/:id/changesets?tab=&limit=`                                                                                                | `<id>  rev <n>  "<tab>"  <name>[ (agent)]  "<summary>"  +a ~c -r  <YYYY-MM-DD HH:MM>`               |
| `changeset show <doc> <changeset>`                                                                                                      | `changeset.show`   | `GET /documents/:id/changesets/:changesetId`                                                                                               | the summary line, then the changeset's result lines                                                 |
| `changeset revert <doc> <changeset>`                                                                                                    | `changeset.revert` | `POST /documents/:id/changesets/:cs/revert`                                                                                                | result lines, then `kept <ref> (<reason>)` lines                                                    |
| `comment ls <doc> [--tab] [--status open\|resolved\|all]`                                                                               | `comment.ls`       | `GET /documents/:id/comments?status=`                                                                                                      | the comments view's thread lines                                                                    |
| `comment add <doc> [--tab] <ref> <text>`                                                                                                | `comment.add`      | `POST .../tabs/:tabId/comments { elementId, text }` (201)                                                                                  | `+ comment <id> on <ref>`                                                                           |
| `comment reply <doc> [--tab] <ref> <text>`                                                                                              | `comment.reply`    | `POST .../comments/:lastCommentId/reply { text }` (201)                                                                                    | `+ comment <id> on <ref>`                                                                           |
| `comment resolve\|reopen <doc> [--tab] <ref>`                                                                                           | `comment.<verb>`   | `POST .../comments/:lastCommentId/<verb>` (204)                                                                                            | `~ thread <ref> resolved\|open`                                                                     |
| `presence set <doc> [--tab] [--status <text>] [--focus <refs>] [--ttl <s>]`                                                             | `presence.set`     | `PUT .../presence` (`--focus` comma-separated, `--ttl` seconds sent as ms); `parseAgentPresenceRequest` first                              | `presence on "<tab>" until <HH:MM:SS>`                                                              |
| `presence clear <doc> [--tab]`                                                                                                          | `presence.clear`   | `DELETE .../presence`                                                                                                                      | `presence cleared on "<tab>"`                                                                       |
| `wait <doc> --for comment\|change [--tab] [--timeout <s>]`                                                                              | `wait`             | the room stream                                                                                                                            | the comment's thread lines, the change line, or the timeout line (CLI33)                            |
| `watch <doc> [--tab]`                                                                                                                   | `watch`            | the room stream                                                                                                                            | one line per event (CLI33); `--json` one object a line                                              |
| `graph lint <file> [--compare <variants>]`                                                                                              | `graph.lint`       | none                                                                                                                                       | the lint output                                                                                     |
| `graph render <file> --png <out>\|--svg <out>`                                                                                          | `graph.render`     | none                                                                                                                                       | `<path>  <w>×<h> · <size>`                                                                          |
| `pull <doc> [--to <dir>] [--svg]`                                                                                                       | `pull`             | document, tabs, `render.svg`                                                                                                               | the paths written                                                                                   |
| `push <file>` + write flags                                                                                                             | `push`             | changesets                                                                                                                                 | per tab: its result lines, or `! stale <tab>`                                                       |
| `export --all --to <dir> [--format json,svg,png,mermaid,md]`                                                                            | `export`           | the sweep, documents, tabs, `render.svg`                                                                                                   | the paths written, then `<n> documents · <m> files`                                                 |
| `workbench open <doc> [--tab] --origin <origin>`                                                                                        | `workbench.open`   | `POST /workbench/tickets`                                                                                                                  | the link; `--json` the ticket answer                                                                |
| `workbench pair --origin <origin> [--name <name>]`                                                                                      | `workbench.pair`   | `POST /workbench/pairing-requests`, then its status                                                                                        | the approval link, then `paired <origin>`                                                           |
| `template ls`, `template view <kind>`                                                                                                   | `template.*`       | `GET /templates`, `GET /templates/:kind`                                                                                                   | `<kind>  <title>  <category>`; the template's outline                                               |
| `icon search <text> [--limit n]`                                                                                                        | `icon.search`      | `GET /icons?query=&limit=`                                                                                                                 | `<icon id>  <label>`                                                                                |
| `schema [kind]`                                                                                                                         | `schema.view`      | `GET /schema`, `GET /schema/:kind`                                                                                                         | the kinds, or one kind's fields                                                                     |
| `guide [topic]`                                                                                                                         | `guide`            | none                                                                                                                                       | the topic list, or the topic                                                                        |
| `skill print`, `skill install --to <dir>`                                                                                               | `skill.*`          | none                                                                                                                                       | the `SKILL.md`; the path written                                                                    |
| `api <method> <path> [--body <file>\|-]`                                                                                                | `api`              | that route (CLI53)                                                                                                                         | the response body, as sent                                                                          |
| `auth login [--device\|--with-token]`, `auth status`, `auth logout`                                                                     | `auth.*`           | the OAuth server; `tokens/current`                                                                                                         | `signed in to <host> as <name>`; the status lines; `signed out of <host>`                           |
| `telemetry on\|off`                                                                                                                     | `telemetry.*`      | `POST /events` (the flip only)                                                                                                             | `telemetry on\|off`                                                                                 |

- `document create` without `-f` or `--template` sends one tab with `elements: []`; `--tab` defaults to the
  document's name (CLI75). `-f` holding edit operations exits 1 ("a new document is built from a graph, Mermaid,
  elements or a template"). The id is the CLI's `crypto.randomUUID()`; the api derives the creation intent from the
  tabs it compiles, and `source: 'cli'` is not counted by Made by AI.
- `tab view` maps `--ref` to `ref` (required by `show`), `--text` to `q` (required by `find`) and `--all` to `all=1`
  (resolved threads in `comments`).
- `auth status` lines, two spaces after the key: `host`, `account`, `token` (its name), `role`, `expires`
  (`YYYY-MM-DD`, then `(in <n> days)`), `source` (`env`, `keychain` or `file`).

### Exit codes

`EXIT = { done: 0, rejected: 1, usage: 2, notFound: 3, auth: 4, conflict: 5, rateLimited: 6, failure: 7 }`.
`exitCodeForStatus(status)` (CLI14); `failureOf(err, host)` adds the message, the candidates and the hint:

| Answer                                                                       | Exit |
| ---------------------------------------------------------------------------- | ---- |
| 400, 405 (`use_changesets`), 413, 422                                        | 1    |
| 401, 403 (`read_only_token` and every other refusal)                         | 4    |
| 404, 410                                                                     | 3    |
| 409 (`changeset_conflict`, `elements_held`, `tab_busy`, `tab_id_taken`), 412 | 5    |
| 429                                                                          | 6    |
| 5xx, a timeout, a network failure                                            | 7    |

### Output

- **Text** is the verb's `text(output)`; each line ends in `\n`; no ANSI colour, ever (CLI47).
- **`--json`** prints the output object as one compact JSON document. `--json a,b` keeps those keys of the object,
  or of each item of `listKey` for a list. An unknown field exits 2 listing the valid ones. View verbs ask the api
  with `json=1`.
- **`-q`** prints `quiet(output)`, one ref or id a line; a list's footer goes to stderr.
- **Lists** stop at `--limit` (default `LIST_DEFAULT_LIMIT`, at most `LIST_MAX_LIMIT`) and end with one stdout line
  when cut: `… <n> more; --limit <m>, or narrow with <how>`. An empty list prints `no <things>` (with
  `match "<query>"` when narrowed).
- **Errors** go to stderr in `formatError`'s shape:

```text
error: "Auth" matches 3 documents
  3f9c1a2b  "Auth flow"         personal
  7d02e1aa  "Auth flow v2"      Platform
  a11b0c3d  "Authentication"    personal
hint: livediagram tab view 3f9c
```

With `--json`, stderr holds `{"error":"<code>","message":"…","candidates":[…],"hint":"…"}` instead. A changeset
rejection prints the api's `text` (the engine's `formatRejections`) between the `error:` and `hint:` lines; a role
refusal prints the api's message.

### Help

- **Top** (`livediagram`, `livediagram --help`), final copy, within `HELP_TOP_MAX_TOKENS`:

```text
livediagram: read, build, edit and discuss documents.

Usage: livediagram <resource> <verb> [args] [flags]

Resources
  document (doc)  ls, view, create, rename, share, rm, restore
  tab             ls, view, add, rename, rm, diff, render, lint
  element (el)    add, set, rm, move, connect, insert, wrap
  item            ls, add, set, move, rm
  changeset       apply (edit), ls, show, revert
  comment         ls, add, reply, resolve, reopen
  presence        set, clear
  wait, watch     block until, or stream, comments and changes
  graph           lint, render: a graph or Mermaid file, before writing
  pull, push      one document to a file and back; export --all
  template, icon, schema, guide, skill, api, auth, telemetry

Addressing
  <doc>     name, id prefix or livediagram URL     "Auth flow", 3f9c
  --tab     tab name or id prefix; the first tab when omitted
  elements  refs from a view, or selectors          146b, type:sticky

Output
  stdout is data; hints go to stderr. Compact text by default,
  --json [fields] for JSON, -q for refs and ids only.
  Writes print what changed and the revert; --dry-run writes nothing.
  Exit: 0 done, 1 rejected, 2 usage, 3 not found, 4 auth,
  5 conflict, 6 rate limited, 7 network or server.

Start
  livediagram document ls auth        find a document
  livediagram tab view "Auth flow"    its first tab, as an outline
  livediagram edit "Auth flow" -f -   edit operations from stdin
  livediagram guide build             build a diagram from scratch

Sign in: LIVEDIAGRAM_TOKEN, or livediagram auth login. Never prompts.
More: livediagram <resource> --help, livediagram guide <topic>
```

- **Resource** (`livediagram <resource> --help`), within `HELP_RESOURCE_MAX_TOKENS`: the resource's one-line
  description, then `  <verb>  <summary>` per verb in catalogue order, then
  `More: livediagram <resource> <verb> --help`.
- **Verb** (`livediagram <resource> <verb> --help`), within `HELP_VERB_MAX_TOKENS`: the description; `Usage:` built
  from `cli.positionals` and the flags; `Flags`, one line each with the zod `.describe()` text; `Examples`, the two
  of `cli.examples`; `Prints: <cli.prints>`. Write flags share one description each, kept in `WRITE_FLAG_TEXT`.
- **Guide** (`livediagram guide`) lists the six topics one line each; `guide <topic>` prints the topic, within
  `GUIDE_TOPIC_MAX_TOKENS` (CLI49). The `edit` topic shows `element connect <doc> <a> <b>` and says why `->` is
  never typed unquoted. The `workbench` topic is the
  [workbench blueprint](../../013-workspace/blueprints/workbench-embeds.md#the-cli)'s.
- **Skill**: `renderSkill()` gives frontmatter `name: livediagram` and `description: SKILL_DESCRIPTION` (within
  `SKILL_FRONTMATTER_MAX_TOKENS`), then a body naming the four starting commands, each guide topic's command and
  the `[livediagram]` line that sends an agent to `guide workbench` (within `SKILL_BODY_MAX_TOKENS`).
  `skill install --to <dir>` writes `<dir>/livediagram/SKILL.md`, overwriting only a file whose frontmatter `name`
  is `livediagram` (CLI52). Without `--to` it exits 2 listing `SKILL_DIRECTORIES`:

```text
error: skill install needs --to <dir>, the skills directory of your agent
  ~/.claude/skills      Claude Code, every project
  ./.claude/skills      Claude Code, this project
  ./.agents/skills      the open Agent Skills layout, this project
hint: livediagram skill install --to ~/.claude/skills
```

### Capabilities

```ts
type CapabilitiesResponse = {
  aiEnabled: boolean;
  emailEnabled?: boolean;
  driveMode?: DriveMode;
  apiBase?: string; // `${url.origin}/api` (CLI9)
  authEnabled?: boolean; // CLERK_JWKS_URL is set (CLI11)
  oauthIssuer?: string; // OAUTH_ISSUER, an https origin; absent when unset or invalid
  documentFormat?: number; // DOCUMENT_FORMAT
  cli?: { minVersion: string }; // CLI_MIN_VERSION when it is x.y.z; absent otherwise
};
```

Optional so an older worker parses. The CLI treats an absent `apiBase` as `<host>/api`, an absent `authEnabled` as
false, an absent `documentFormat` as equal to its own.

### Token self-service (api)

- `GET /api/tokens/current` (token callers only: another method is 405 first; a session or guest gets 403
  `not_a_token`; a dead token never arrives, as the front door answers 401 `invalid_token`; a row revoked between
  resolution and the read gets 404, CLI39) →
  200 `CurrentTokenResponse = { accountId, accountName, tokenId, tokenName, role, expiresAt }`; `role` is
  `ctx.token.role`, printed as the api names it. `accountName` is the owner's participant name, `null` when none.
- `DELETE /api/tokens/current` → 204 after `revokeApiToken(env, owner, ctx.token.id)` and the
  `recordTokenRevoked` Timeline entry `/api/tokens/:id` writes.
- Both are reached before the session-only gate in `handleTokens`, through `ctx.token`. The token write choke point
  admits `DELETE /api/tokens/current` for a token of any role, as revoking itself escalates nothing.

### Catalogue routes (api)

`handleCatalogues(ctx)` in `apps/api/src/routes/catalogues.ts`, for the segments `templates`, `icons` and `schema`;
no identity needed (public catalogues, like `capabilities`); `GET` only (405 otherwise); `Cache-Control: public,
max-age=300` (CLI72).

| Path                           | Success                                                                                                                        | Failures                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /api/templates`           | 200 `TemplateCatalogueResponse = { categories, templates: { kind, title, description, category }[] }`, `list_templates`' shape | none                                                                                             |
| `GET /api/templates/:kind`     | 200 `text/plain`: `renderView` outline of `buildTemplateTab(kind)`; `json=1` its JSON                                          | 404 `unknown_template { kinds }`                                                                 |
| `GET /api/icons?query=&limit=` | 200 `IconSearchResponse = { icons: { id, label, set: 'line' \| 'technology' }[], more }`                                       | 400 `invalid_value` (query 1 to `ICON_QUERY_MAX` characters, limit 1 to `ICON_SEARCH_MAX_LIMIT`) |
| `GET /api/schema`              | 200 `text/plain`: `elementFormatText()`, the kinds one line each                                                               | none                                                                                             |
| `GET /api/schema/:kind`        | 200 `text/plain`: `elementFormatText(kind)`, the kind's fields, values and defaults                                            | 404 `unknown_kind { kinds }`                                                                     |

- `searchIcons(query, limit)` (`@livediagram/icons`) ranks the line-art and Technology catalogues by `paletteRank`
  over each icon's label and keywords, ties in catalogue order (CLI74).
- `elementKindsText()` and `elementFormatText(kind)` (`@livediagram/edit-operations`) are read off the engine itself:
  the kinds `add` makes (`buildKind`'s factories), each kind's first size, the aliases `set` takes for it (`aliasesOf`)
  with their values (theme slots, sticky presets, border styles, text sizes, line styles), and its stored fields; a
  shape names `SHAPE_COMMON_FIELDS` and its kind's `SHAPE_KIND_FIELDS`, as the shape type's fields span every kind.
  Each kind is within `SCHEMA_KIND_MAX_TOKENS`. The MCP's schema resource keeps its own prose (CLI73).
- The catalogue owns only these commands' help; their content is the api's.

### OAuth server (apps/mcp)

- **Clients.** `lookupClient(env, clientId)` returns `BUILT_IN_CLIENTS[clientId]` first, then the KV registration.
  `BUILT_IN_CLIENTS = { [CLI_CLIENT_ID]: { clientName: CLI_CLIENT_NAME, redirectUris: CLI_REDIRECT_URIS } }` with
  `CLI_REDIRECT_URIS = ['http://127.0.0.1/callback', 'http://[::1]/callback']` (CLI35). Registration mints random
  hex ids, so it can never take `livediagram-cli`.
- **Redirects.** `redirectUriAllowed(registered, uri)`: exact match, or, when the registered URI's host passes
  `isLoopbackHostname` and its scheme is `http:`, the same scheme, hostname and path with any port (RFC 8252 §7.3).
  `/oauth/authorize` uses it for every client.
- **Session lookup.** `GET /oauth/session/:id` answers `{ clientName, redirectHost, clientId }`; `clientId` is
  public and lets the consent page tell the CLI from an MCP client for telemetry only (CLI77).
- **Metadata** adds `device_authorization_endpoint` and `grant_types_supported: ['authorization_code',
DEVICE_CODE_GRANT]`.
- **Device routes** (`registerDeviceRoutes`), all JSON or form, CORS as the worker's:

| Method | Path                              | Body                                                       | Success                                                                                         | Failures                                                                                     |
| ------ | --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| POST   | `/oauth/device_authorization`     | `client_id`                                                | `{ device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }` | 400 `invalid_client` (not built in); 429 `rate_limited`                                      |
| GET    | `/oauth/device/session/:userCode` |                                                            | `{ clientName }`                                                                                | 404 `invalid_code`; 429                                                                      |
| POST   | `/oauth/device/complete`          | `{ userCode, token, expiresAt }`                           | `{ ok: true }`                                                                                  | 400 `invalid_request`, `invalid_code`                                                        |
| POST   | `/oauth/device/deny`              | `{ userCode }`                                             | `{ ok: true }`                                                                                  | 400 `invalid_code`                                                                           |
| POST   | `/oauth/token`                    | `grant_type=DEVICE_CODE_GRANT`, `device_code`, `client_id` | `{ access_token, token_type: 'Bearer', expires_in }`                                            | 400 `authorization_pending`, `slow_down`, `access_denied`, `expired_token`, `invalid_client` |

`verification_uri` is `${CONSENT_BASE_URL}/oauth/device`; `_complete` adds `?code=<user code>`. `device_code` is 32
random bytes, base64url; `user_code` is 8 letters of `USER_CODE_ALPHABET`, printed `XXXX-XXXX` and matched after
`normaliseUserCode` (upper case, hyphens and spaces dropped) (CLI36).

### The CLI's OAuth client

- `discover(issuer)`: `GET {issuer}/.well-known/oauth-authorization-server`; the endpoints must share the issuer's
  origin, else exit 4.
- `loginWithBrowser`: PKCE verifier of 32 random bytes (43 base64url characters), S256 challenge, 16-byte `state`;
  `http.createServer` on `127.0.0.1`, port 0; authorize URL with `client_id=livediagram-cli`, `redirect_uri`
  `http://127.0.0.1:<port>/callback`, `response_type=code`, `code_challenge_method=S256`; opens the browser
  (`openBrowser`: `open` on macOS, `xdg-open` on Linux, `cmd /c start ""` on Windows) and always prints the URL to
  stderr. The first `GET /callback` with the matching `state` answers the callback page and closes the server;
  `error=access_denied` ends with exit 4. `POST /oauth/token` form `grant_type=authorization_code`, `code`,
  `code_verifier`, `redirect_uri`, `client_id`. Timeout `LOGIN_TIMEOUT_MS`.
- `loginWithDevice`: `POST /oauth/device_authorization`; stderr: `Open <verification_uri> and enter <user code>.`
  and the complete URL; polls `/oauth/token` every `interval` seconds, honouring `slow_down`.
- `loginWithToken`: stdin must not be a terminal (exit 2 otherwise); reads to end, trims, `isApiTokenFormat`, else
  exit 1.
- All three end in `GET {apiBase}/tokens/current` with the new token, then `store.put(profile, credential)`, then
  the replaced token's revoke (Credentials).

### api-client

```ts
type ApiClientOptions = {
  baseUrl: string; // 'https://livediagram-api/api' for the MCP binding, caps.apiBase for the CLI
  fetch: (request: Request) => Promise<Response>;
  headers: () => Record<string, string>; // Authorization; X-Livediagram-Client: mcp | cli; X-Share-Code when addressed by a link
  onFailure?: (kind: string) => void; // 'Http503' | 'Internal', 5xx and network only
  timeoutMs?: number;
};
type ApiClient = {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  json<T>(path: string, init?: RequestInit): Promise<T>;
  text(path: string, init?: RequestInit): Promise<{ body: string; etag: string | null }>;
};
class ApiError extends Error {
  status: number;
  body: string;
  code: string | null; // the body's `error`
}
function postEvents(
  baseUrl: string,
  fetch: ApiClientOptions['fetch'],
  events: TelemetryEvent[],
  extraHeaders?: Record<string, string>,
): Promise<void>;
```

The MCP's `apiFetch` / `apiJson` / `postTelemetry` / `reportApiFailure` become thin wrappers over it, with
`onFailure` reporting `errorTypeToken(kind, currentTool())` as today.

### render-png

```ts
type PngLoaders = {
  wasm: () => Promise<WebAssembly.Module | ArrayBuffer | Uint8Array>;
  font: () => Promise<Uint8Array | ArrayBuffer>;
};
function createPngRenderer(loaders: PngLoaders): {
  renderPng(
    svg: string,
    scale?: number,
  ): Promise<{ png: Uint8Array; width: number; height: number }>;
};
```

`initWasm` runs once per process, whichever renderer asks first (a failed load is retried); Inter is the only and default font, no system fonts, as `render.ts` does. The MCP
passes its imported module and font; the CLI reads `resvg.wasm` and `Inter-Regular.ttf` beside the bundle
(`CliIo.readAsset`; the build copies them, with `Inter-OFL.txt`), and only when a render verb runs (CLI31). A missing
file exits 7 naming it.

### The pull file

The `livediagram.document` envelope (`DocumentEnvelope`, schema version 1, from the moved `document-envelope.ts`),
so the editor's "Import a copy" reads it, plus one key the envelope parser ignores (CLI27):

```ts
type PullSync = {
  host: string; // the profile's host
  pulledAt: number;
  // hash: SHA-256 hex of the canonical JSON of the elements; settingsHash: of every other field (CLI28)
  tabs: Record<string, { rev: number; hash: string; settingsHash: string }>;
};
type PullFile = DocumentEnvelope & { livediagramSync: PullSync };
```

### Telemetry

- `Cli·Used·<pascalToken(verb.id)>` (`TabView`, `ElementSet`) for each of `countedVerbs()`: every verb that reaches a
  host (not the `offline` guides and skill), except `telemetry on|off`; `Error·Api·Http<status>.<Verb>` on a 5xx and
  `Error·Api·Internal.<Verb>` on a network failure; never a 4xx (CLI41).
- `POST {apiBase}/events` `{ events: [one] }`, no `Authorization`, no `Origin`, awaited at most
  `TELEMETRY_FLUSH_TIMEOUT_MS`.
- Off when `LIVEDIAGRAM_TELEMETRY=0`, `DO_NOT_TRACK` is set to anything but `0` or empty (CLI42), or
  `telemetry = false` in `config.toml`. `telemetry off` sends `UI·Toggled·TelemetryOff` and then writes the setting;
  `telemetry on` writes it and then sends `UI·Toggled·TelemetryOn`; neither sends `Cli·Used`.
- The first command after install that would send prints the notice (Presentation) once, recorded in
  `state.json`.
- A CLI sign-in counts as `Token·Created·Cli`: the consent page sends it when the session's `clientId` is
  `CLI_CLIENT_ID` (else `MCP`, as today), and the device page always; charted as `CLI Sign-Ins` in API Token
  Activity.

### Update check

After a command exits 0, when `CI` is unset or empty, stderr is a terminal, `LIVEDIAGRAM_NO_UPDATE_CHECK` is not
`1`, and `update.json`'s `checkedAt` is older than `UPDATE_CHECK_INTERVAL_MS`: `GET
https://registry.npmjs.org/livediagram/latest` with `UPDATE_CHECK_TIMEOUT_MS`; `checkedAt` and `latest` are stored
whatever the answer; a newer `version` prints the notice (CLI43).

## Data and persistence

No D1 table, no migration. Local files (CLI5):

| File                                                  | Class   | Notes                                                                                                                                                                             |
| ----------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<config>/config.toml`                                | config  | `default_profile`, `telemetry`, `[profiles.<name>] host`; written only by `telemetry`                                                                                             |
| macOS Keychain, Secret Service: service `livediagram` | secret  | Account = profile name; value = the token alone (CLI4)                                                                                                                            |
| `<config>/credentials.json`                           | secret  | `{ version: 1, profiles: { <name>: StoredCredential } }`; the token itself only when the file is its store, a DPAPI blob (`sealed`) on Windows; file 0600, directory 0700 (CLI40) |
| `<cache>/capabilities/<profile>.json`                 | derived | `{ fetchedAt, host, capabilities }`; discarded when older than `CAPABILITIES_CACHE_TTL_MS`                                                                                        |
| `<cache>/copies/index.json`                           | derived | `{ version: 1, entries: { key, rev, bytes, at }[] }`, most recent first                                                                                                           |
| `<cache>/copies/<key hash>/<rev>.json`                | content | One read copy, the plain tab as served; files 0600 in 0700 directories (CLI76)                                                                                                    |
| `<cache>/update.json`                                 | derived | `{ checkedAt, latest }`                                                                                                                                                           |
| `<cache>/state.json`                                  | state   | `{ telemetryNoticeAt }`                                                                                                                                                           |
| `<slug>.livediagram.json`                             | content | The pull file; the person's to keep                                                                                                                                               |

`StoredCredential = { host, token, tokenId, accountName, role, expiresAt }`. `<key hash>` is the first 16 hex of
SHA-256 over `<profile>|<documentId>|<tabId>`. Every write is a temporary file in the same directory then
`rename`. An unreadable or wrong-version derived file is ignored and rewritten; a malformed `config.toml` or
`credentials.json` exits 2 naming the file and the line. Server state: the device grant's two KV keys, TTL 600 s;
nothing in D1.

## Errors and edge cases

- **E1** `livediagram.app` redirects to `www.livediagram.app`: the capabilities `GET` follows it, and every later
  request goes to `apiBase` directly, so no `Authorization` header crosses a redirect.
- **E2** `connect a -> b` unquoted in a shell redirects stdout to a file named `b`: `element connect <doc> <a> <b>`
  takes the ends as two words and inserts the arrow (CLI23); the `edit` guide says so.
- **E3** A word holding spaces (`label="Sign in"` arrives as `label=Sign in`) is re-quoted by `argvToOperationLine`.
- **E4** A ref printed earlier is now ambiguous: the api's `target_ambiguous` text, exit 1, hint to re-read.
- **E5** The read copy is far behind: the api rebases or conflicts as for any base; nothing local special-cases it.
- **E6** A tab deleted since the read copy: `resolveTab` fails first, exit 3.
- **E7** A document moved to the Trash: 410, exit 3, hint `livediagram document restore <id>`.
- **E8** A token whose role does not admit the write: 403, exit 4, the api's message, hint
  `livediagram auth status` (which shows the role).
- **E9** The browser never returns (closed tab, wrong account): the loopback times out after `LOGIN_TIMEOUT_MS`,
  exit 4, hint `--device`.
- **E10** The person's account is at the token cap: the consent page shows its error; the CLI times out (E9) and the
  hint adds "or revoke a token in Settings › API Tokens".
- **E11** A second `/callback` request (a refresh, a probe): answered 404 once the first valid one closed the
  server; a wrong `state` answers 400 and keeps waiting.
- **E12** Device page and poll in different regions: a KV read can miss a fresh write for up to a minute; the page
  says "We couldn't find that code yet" with Try again, and the CLI keeps polling until expiry.
- **E13** The platform's tool is missing, or refuses a store: the file store, with the one-line notice. A stored keychain token the tool cannot read back: exit 4, hint `livediagram auth login`.
- **E14** `credentials.json` readable by group or others: stderr warning, mode set to 0600, read continues.
- **E15** `LIVEDIAGRAM_TOKEN` is set but not `lvd_`-shaped: exit 4 "LIVEDIAGRAM_TOKEN is not an API token".
- **E16** `--host` and `--profile` together: exit 2 (CLI7).
- **E17** A pasted URL on another host than the profile's: exit 2, hint `--host <origin>` (CLI21).
- **E18** `push` of a file pulled from another host: exit 2.
- **E19** `push` when two tabs changed and the second is stale: the first lands, the second prints `! stale`, exit
  5; the file records only the first.
- **E20** A pull file edited into invalid JSON or an invalid tab: exit 1 naming the tab; nothing sent.
- **E21** `tab diff --since` a revision with no read copy: exit 3 naming the revisions held (CLI79).
- **E22** The room's 256 KiB frame cap: ops arrive whole or as `refetch: true` changesets; `watch` prints those
  with their counts, no element lines.
- **E23** Reconnect misses ops: stderr `may have missed changes: livediagram tab diff <doc> --tab <t> --since <rev>`
  with the latest read copy's revision.
- **E24** `export` meets the token read limiter (120 a minute): 429 answers are retried after 60 s, up to three
  times per request, before exit 6.
- **E25** `api` given an absolute URL, or a tab `PUT`: exit 2; the token never leaves the host (CLI53, I4).
- **E26** A render of a tab whose SVG fails to rasterise: exit 7 for the CLI's own failure, with the SVG still
  writable by `--svg`.
- **E27** An unexpected exception: stderr `error: internal error (<ErrorName>)` and `hint: run again with
LIVEDIAGRAM_DEBUG=1 and report it at https://github.com/livediagram-app/livediagram.app/issues`, exit 7 (CLI16).
- **E28** Unknown keys in `config.toml`: ignored, logged under debug.
- **E29** A read copy evicted between `wait` printing a revision and `tab diff`: E21.
- **E30** `comment reply|resolve|reopen` on an element with no thread: exit 3 (CLI78).

## Security and trust

- **No token in argv.** No `--token` flag; the env variable or stdin only. `auth status` never prints the secret;
  debug lines redact `Authorization`.
- **Credentials at rest.** The platform's store first, the token on the tool's stdin and never in its argv (`ps`
  shows only the profile name); the file at 0600 in a 0700 directory, written by temporary file and
  rename so no partial file is ever readable. Read copies hold document content and get the same modes.
- **The loopback.** Bound to `127.0.0.1` only; `state` checked; one use; closed after the code; PKCE S256 with a
  32-byte verifier. The port-agnostic match applies to `http` loopback URIs only, and the hostname must equal the
  registered one (`127.0.0.1`, `[::1]` and `localhost` are distinct).
- **The built-in client.** Its name is the server's, so the consent page's "Connect livediagram CLI" is true; the
  anti-phishing line still shows the redirect host the server read. `clientId` on the session lookup is not a
  secret and decides nothing but the telemetry type.
- **The device grant.** User codes have 20⁸ (2.6 × 10¹⁰) values, live 10 minutes, are single use, and their lookup
  is rate limited per IP (`DEVICE_LOOKUP_RATE_MAX`); `device_authorization` is limited like registration
  (`DEVICE_AUTH_RATE_PER_HOUR`). Only the built-in client may start one. The page names the client from the server
  and warns: "Only enter a code shown by a terminal you are using." The token travels from the page to the trusted
  `MCP_ORIGIN` only, as the consent page's does.
- **Hosts.** A self-host profile reaches its own host only (I5); telemetry goes to that host's api; the update
  check goes to npm and carries nothing but the request. `api` refuses absolute URLs. `LIVEDIAGRAM_TOKEN` goes to
  whichever host is active; `auth status` shows that host, and the README says to set `LIVEDIAGRAM_HOST` beside it.
- **Share links.** A link's code rides only on the command that was given its URL, and only to that host.
- **Catalogue routes** expose only public catalogue data, need no identity, and are cacheable.
- **Supply chain.** Published by CI with provenance through npm trusted publishing (no npm token stored); the
  package's `files` allowlist is the bundle, the wasm, the font, the licences and the README; no install scripts;
  no native addon: the keychain is the platform's own tool.
- **Roles.** The CLI enforces nothing the api does not; every refusal is the api's gate (`gateComment`,
  `gateParticipate`, `gateEdit`), mapped to exit 4.

## Performance and limits

- **Requests per command.** A full id: capabilities (cached), one document read, the action. A name or prefix: the
  sweep, `2 + teams` reads. `tab view` reads the view and the plain tab in parallel; a changeset write adds one
  plain read after landing. `export --all`: the sweep plus, per document, one read and per tab one read and one
  `render.svg`, `EXPORT_CONCURRENCY` at a time, under the token's 120 reads a minute.
- **Start-up.** One ESM file; `@livediagram/render-png`, the wasm and the font are loaded only by `tab render`,
  `graph render`, `pull --svg` and `export` with `png`. `--help` evaluates no handler module beyond the catalogue.
- **Package.** At most `CLI_PACKAGE_MAX_BYTES` unpacked (the wasm is 2.5 MB, the font 0.3 MB).
- **Room stream.** One socket; no frames sent; reconnect backoff bounded by `ROOM_RECONNECT_MAX_MS`.
- **Read copies.** At most `READ_COPY_MAX_BYTES` on disk; one tab is at most `MAX_TAB_BYTES` (1.9 MB), so even the
  largest tabs keep several copies.
- **Device polling.** One request per `interval` (5 s or more) for at most 10 minutes: 120 requests.
- **Catalogue routes.** Pure functions over bundled data; one icon search ranks the two catalogues in
  well under a millisecond.

## Presentation and UX

- **Callback page** (served by the loopback, `text/html`, no script, dark and light by `prefers-color-scheme`):
  title "livediagram CLI", heading "You're signed in", body "Return to your terminal. You can close this tab." On
  `access_denied`: "Sign-in cancelled", "Nothing was connected. You can close this tab."
- **`/oauth/device` page**, in `OauthShell` (CLI65):
  - not `clerkEnabled`: "Connecting apps isn't available" / "This deployment doesn't have accounts enabled, so
    there's nothing to connect to."
  - signed out: "Sign in to connect the livediagram CLI", with Sign in (back to this URL) and Cancel.
  - entry: heading "Connect a terminal", label "Code shown in your terminal", an 8-letter field formatted
    `XXXX-XXXX`, prefilled from `?code=`; button "Continue"; line "Only enter a code shown by a terminal you are
    using."
  - checking: "Checking this code…".
  - not found: "We couldn't find that code yet" / "Check it and try again. Codes last 10 minutes." with Try again.
  - consent: "Connect {clientName}", the consent page's paragraph and its role choice, Connect and Cancel.
  - done: "You're connected" / "Return to your terminal; it carries on by itself."
  - cancelled: "Connection cancelled" / "Your terminal will stop waiting."
  - error: "Something went wrong. Please try again."
- **CLI notices** (stderr), final copy:
  - telemetry: `livediagram counts which commands succeed (the command's name only: never arguments, documents or
hosts) and sends the count to <host>. Turn it off: livediagram telemetry off, or LIVEDIAGRAM_TELEMETRY=0.`
  - update: `livediagram <latest> is available (this is <current>): npm install -g @livediagram/cli@latest, or
npx @livediagram/cli@latest`
  - expiry: `this token expires in <n> days: livediagram auth login to renew`
  - keychain: `no keychain here; the token is stored in <path> (readable only by you)`
  - loopback: `Opening <url> in your browser. If it does not open, open it yourself.`
  - device: `Open <verification_uri> and enter <XXXX-XXXX>. Waiting for approval…`
  - not pushed: `not pushed: tab "<name>" <name|theme|background> changed; push sends elements only` and
    `not pushed: tab "<name>" is not in the file; nothing was deleted`
- **`wait` timeout** (stdout): `nothing new in <n> s`.
- **CLI errors**, final copy (each followed by its `hint:`):

| Situation                 | `error:`                                                                   | `hint:`                                                                                         |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No credential             | `not signed in to <host>`                                                  | `livediagram auth login, or set LIVEDIAGRAM_TOKEN`                                              |
| Host without sign-in      | `<host> has no sign-in, so the CLI cannot act there`                       | none                                                                                            |
| Host without OAuth server | `<host> has no sign-in server for the CLI`                                 | `create a token in Settings › API Tokens, then pipe it to: livediagram auth login --with-token` |
| Below the floor           | `<host> accepts writes from livediagram <min> or later; this is <v>`       | `UPGRADE_HINT`: `npm install -g @livediagram/cli@latest, or npx @livediagram/cli@latest`        |
| Newer document format     | `<host> stores documents newer than this livediagram reads (<v>)`          | `UPGRADE_HINT`: `npm install -g @livediagram/cli@latest, or npx @livediagram/cli@latest`        |
| Unknown verb              | `unknown verb "<v>" for "<resource>"`, `  did you mean: <x>`               | `livediagram <resource> --help`                                                                 |
| Unknown flag              | `unknown flag <flag> for "<command>"`                                      | `livediagram <command> --help`                                                                  |
| Not found                 | `no <document\|tab> matches "<x>"`, nearest lines                          | `livediagram document ls` / `livediagram tab ls <doc>`                                          |
| Ambiguous                 | `"<x>" matches <n> <documents\|tabs>`, candidates                          | the command with the first candidate's ref                                                      |
| Unknown `-f` content      | `can't tell what <file> holds`                                             | `expected edit operations, a graph, Mermaid or elements: livediagram guide edit`                |
| Conflict                  | `<n> elements changed since rev <base> (now <rev>):`, `  <ref> (<reason>)` | `re-read: livediagram tab view <doc> --tab <t>`                                                 |
| Held                      | `<n> elements are selected by people:`, `  <ref> (<name>)`                 | `retry later, or add --wait-held 30`                                                            |
| Stale (`--strict`)        | `"<tab>" changed since rev <base> (now <rev>)`                             | `re-read: livediagram tab view <doc> --tab <t>`                                                 |
| Rate limited              | `<host> is rate limiting this token`                                       | `wait a minute, then retry`                                                                     |
| Network                   | `could not reach <host> (<code>)`                                          | `check the connection, or choose another host with --host`                                      |
| Server                    | `<host> failed (HTTP <status>)`                                            | `retry shortly`                                                                                 |

## Accessibility

- **Terminal.** Plain text only: no colour (meaning never rides on colour), no spinner, no cursor movement, no box
  drawing, so a screen reader reads every line once. The result marks (`+ ~ - »`) are the spec's and always come with
  words.
- **`/oauth/device`.** The code field has a visible label, `autocomplete="one-time-code"`, `inputmode="text"`,
  `autocapitalize="characters"` and an `aria-describedby` pointing at the format line; errors are `role="alert"`;
  the checking line is `role="status"`; focus moves to each state's heading on change; every control is keyboard
  operable with the shared focus ring; contrast uses the consent page's audited tokens; the backdrop is decorative
  and honours reduced motion, as on the consent page. Target sizes are at least 24 by 24 CSS pixels.
- **Callback page.** One heading, one paragraph, `lang="en"`, system colours by scheme, contrast above 4.5:1.

## Web Experience

`/oauth/device` is one statically exported page: text first, so the LCP element is the heading; the card keeps one
fixed width and each state replaces content in the same slot (no layout shift beyond the first paint); the only
interaction is a form submit and two fetches to the MCP origin, so INP stays a single handler's work. No image.

## Observability

CLI lines print to stderr only under `LIVEDIAGRAM_DEBUG=1` (CLI44); server lines go to the worker logs.

| Fingerprint                                                                              | Where                 |
| ---------------------------------------------------------------------------------------- | --------------------- |
| `[cli] command <verb.id>` / `[cli] exit <code> <errorName?>`                             | cli, start and end    |
| `[cli] profile <name> host <host> source <flag\|env\|config\|default>`                   | cli, profile choice   |
| `[cli] credential <env\|keychain\|file\|none>`                                           | cli, credential       |
| `[cli] keychain unavailable <reason>`                                                    | cli, store            |
| `[cli] capabilities <hit\|miss\|stale>`                                                  | cli, capabilities     |
| `[cli] floor refused <current> < <min>`                                                  | cli, floor            |
| `[cli] format refused <host format> > <bundled format>`                                  | cli, floor            |
| `[cli] request <METHOD> <path> <status> <ms>`                                            | cli, every api call   |
| `[cli] address <document\|tab\|ref> <file\|url\|exact\|prefix\|name\|first> <n> matches` | cli, addressing       |
| `[cli] source <graph\|mermaid\|elements\|replace\|operations\|unknown>`                  | cli, `-f`             |
| `[cli] copy <hit\|miss\|recorded\|evicted> <documentId>/<tabId> rev <n>`                 | cli, read copies      |
| `[cli] held retry <attempt>`                                                             | cli, `--wait-held`    |
| `[cli] room <connecting\|open\|closed <code>\|reconnecting <ms>>`                        | cli, room stream      |
| `[cli] telemetry <sent\|skipped <reason>\|timeout>`                                      | cli, telemetry        |
| `[cli] update-check <skipped <reason>\|latest <v>\|failed>`                              | cli, update check     |
| `[oauth] loopback redirect matched <host> any port`                                      | mcp, authorize        |
| `[oauth] device <started\|authorised\|denied\|expired\|slow_down>`                       | mcp, device grant     |
| `[oauth] device <authorization\|lookup> rate-limited`                                    | mcp, warn             |
| `[tokens] current <read\|revoked> <tokenId>`                                             | api, `tokens/current` |
| `[catalogues] <templates\|icons\|schema> <status>`                                       | api, catalogue routes |

Requests carry `X-Livediagram-Client: cli` and `User-Agent: livediagram-cli/<version> node/<version> <platform>`
(CLI45), so the api's own logs and the changeset front door (`Agent·*·Cli`) name the CLI.

## Testing

Every suite runs on fakes (an in-memory `CliIo`: stdout, stderr, stdin, TTY flags, env, clock and its timers, room sockets, SIGINT, files, fetch and
WebSocket) with a fixed clock; none waits on a real timer or the network.

| Spec rule                                                                                     | Test                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource then verb; the `doc` alias; `el` and `edit` with their verbs                         | `apps/cli/src/dispatch/dispatch.test.ts`                                                                                                                    |
| Unknown verb or flag exits 2 with a suggestion; no `--token`                                  | `apps/cli/src/dispatch/dispatch.test.ts`                                                                                                                    |
| Every command in the spec's table exists with its flags                                       | `apps/cli/src/dispatch/commands-table.test.ts` (the table as data, against the routing and each verb's flags)                                               |
| Addressing: name, prefix, URL, share URL, pull file; ambiguity refused with candidates        | `packages/agent-verbs/src/addressing.test.ts`                                                                                                               |
| `--tab` defaults to the first tab                                                             | `packages/agent-verbs/src/addressing.test.ts`                                                                                                               |
| Help within `HELP_TOP/RESOURCE/VERB_MAX_TOKENS`, every verb                                   | `apps/cli/src/help/help.test.ts` (`estimateTokens`, CLI48)                                                                                                  |
| Top help lists resources, addressing, output rules, four commands                             | `apps/cli/src/help/help.test.ts`                                                                                                                            |
| Verb help: usage, flags, two examples, what it prints                                         | `apps/cli/src/help/help.test.ts`                                                                                                                            |
| Guides and skill: commands that exist, edit operations that parse, each within budget         | `packages/agent-verbs/src/catalogue.test.ts`                                                                                                                |
| Schema from the api, each kind within budget                                                  | `packages/edit-operations/src/element-format.test.ts`; `apps/api/src/routes/catalogues.test.ts`                                                             |
| Templates and icons from the api                                                              | `apps/api/src/routes/catalogues.test.ts`; `packages/icons/src/search.test.ts`; `packages/agent-verbs/src/verbs/catalogues.test.ts`                          |
| `skill install` requires `--to`, listing the directories                                      | `apps/cli/src/main.test.ts`                                                                                                                                 |
| Help never sends telemetry                                                                    | `apps/cli/src/telemetry.test.ts`                                                                                                                            |
| stdout data only; hints on stderr                                                             | `apps/cli/src/main.test.ts`, `apps/cli/src/output/output.test.ts`                                                                                           |
| `--json`, `--json <fields>`, unknown field, `-q`                                              | `apps/cli/src/output/output.test.ts`                                                                                                                        |
| Lists end with what was left out                                                              | `packages/agent-verbs/src/verbs/verbs.test.ts`                                                                                                              |
| Errors name what, candidates, one runnable fix                                                | `apps/cli/src/output/output.test.ts`                                                                                                                        |
| Exit codes 0 to 7 by answer                                                                   | `apps/cli/src/output/output.test.ts`                                                                                                                        |
| Never interactive when piped                                                                  | `apps/cli/src/main.test.ts` (stdin read only by `--with-token` and `--body -`; a terminal refused)                                                          |
| Never a whole-tab save                                                                        | `apps/cli/src/main.test.ts` (`api PUT` on a tab refused)                                                                                                    |
| `document create` compiles on the api with `source: 'cli'`                                    | `packages/agent-verbs/src/verbs/lifecycle.test.ts`, `apps/cli/src/writes.test.ts`, `apps/api/src/routes/document-create-seeded.test.ts`                     |
| `tab rename` through the name route                                                           | `packages/agent-verbs/src/verbs/lifecycle.test.ts`                                                                                                          |
| Writes print result lines, revision, changeset, lint, revert                                  | `apps/cli/src/writes.test.ts`                                                                                                                               |
| `--dry-run`, `--summary`, `--base` from the read copy with fingerprints, `--strict`           | `packages/agent-verbs/src/write.test.ts`, `apps/cli/src/writes.test.ts`, `apps/cli/src/sync/read-copies.test.ts`                                            |
| `--wait-held` retries, then exit 5                                                            | `packages/agent-verbs/src/write.test.ts`, `apps/cli/src/writes.test.ts`                                                                                     |
| `changeset apply` from a file and stdin; source kinds                                         | `packages/agent-verbs/src/verbs/edit.test.ts`; `packages/agent-verbs/src/source-kind.test.ts`; `apps/cli/src/input.test.ts`                                 |
| `changeset ls`, `show` and `revert`                                                           | `packages/agent-verbs/src/verbs/verbs.test.ts`                                                                                                              |
| Comments by element ref; reply to the thread                                                  | `packages/agent-verbs/src/verbs/comment.test.ts` (comment and presence verbs)                                                                               |
| `tab diff` from the read copy; missing copy exit 3                                            | `packages/agent-verbs/src/verbs/edit.test.ts`, `apps/cli/src/writes.test.ts`                                                                                |
| Env token before stored; no flag                                                              | `apps/cli/src/auth/credentials.test.ts`                                                                                                                     |
| Loopback PKCE login against the OAuth server                                                  | `apps/cli/src/auth/oauth.test.ts` (in-process fake issuer, the loopback driven as a browser)                                                                |
| Device login, `slow_down`, denial, expiry                                                     | `apps/cli/src/auth/oauth.test.ts`                                                                                                                           |
| `--with-token` from stdin; a terminal refused                                                 | `apps/cli/src/main.test.ts`                                                                                                                                 |
| A new login revokes the replaced token                                                        | `apps/cli/src/main.test.ts`                                                                                                                                 |
| Keychain when available, else the 0600 file                                                   | `apps/cli/src/auth/credentials.test.ts` (the file); `apps/cli/src/auth/keychain.test.ts` (each platform, fallback, no token in argv)                        |
| Status: host, account, name, role, expiry; never the secret; 14 days                          | `apps/cli/src/main.test.ts`                                                                                                                                 |
| Logout revokes and forgets                                                                    | `apps/cli/src/main.test.ts`                                                                                                                                 |
| A host without sign-in says so in one line                                                    | `apps/cli/src/main.test.ts`                                                                                                                                 |
| Profiles, flags, env, default host                                                            | `apps/cli/src/config/config.test.ts`                                                                                                                        |
| Capabilities fields; floor refuses writes, names the version; newer format                    | `apps/api/src/routes/capabilities.test.ts`, `apps/cli/src/config/config.test.ts`, `apps/cli/src/main.test.ts`                                               |
| A self-host profile never contacts livediagram.app                                            | `apps/cli/src/main.test.ts` (every request across a session of commands; telemetry joins it when built)                                                     |
| Pull file: document, tabs, revisions; `--svg`                                                 | `apps/cli/src/sync/pull-file.test.ts`, `apps/cli/src/commands/pull-push.test.ts`                                                                            |
| Push: changed tabs as based changesets; conflict names the tab; elements only                 | `apps/cli/src/commands/pull-push.test.ts`                                                                                                                   |
| Export every document, each format                                                            | `apps/cli/src/commands/export-views.test.ts`                                                                                                                |
| Render prints path and size, never bytes; MCP and CLI draw alike                              | `apps/cli/src/commands/render.test.ts`; `packages/render-png/src/index.test.ts` (size, text drawn in Inter, one wasm initialisation, a failed load retried) |
| `graph lint` and `graph render` write nothing                                                 | `packages/agent-verbs/src/verbs/graph.test.ts`, `apps/cli/src/main.test.ts` (fetch never called)                                                            |
| `wait` blocks, prints, exits, settles a burst, times out; `watch` streams                     | `apps/cli/src/room/room-stream.test.ts`, `room-events.test.ts`, `apps/cli/src/commands/stream-commands.test.ts`                                             |
| Any token role mints a room ticket                                                            | `apps/api/src/index.test.ts` (choke point)                                                                                                                  |
| One catalogue: parity of verbs and tools                                                      | `packages/agent-verbs/src/catalogue.test.ts`; `apps/mcp/src/verb-parity.test.ts`, `packages/agent-verbs/src/verbs/mcp-tools.test.ts`                        |
| Descriptions are facts                                                                        | `packages/agent-verbs/src/catalogue.test.ts` (the MCP's §4.15 checks over every verb)                                                                       |
| Bundle: one ESM file, wasm, font, Node 22, size                                               | `apps/cli/scripts/build.test.ts` (planned); CI `npm pack --dry-run`                                                                                         |
| Update check: once a day, stderr, skipped in CI, non-TTY, opt-out                             | `apps/cli/src/update-check.test.ts` (planned)                                                                                                               |
| Telemetry: after success only, profile's api, opt-outs, flip first, notice once, no arguments | `apps/cli/src/telemetry.test.ts`                                                                                                                            |
| Every emitted event has a chart and a sentence; `Token·Created·Cli`                           | `apps/telemetry` `metric-emitters.test.ts`, `event-explanation.test.ts`; `apps/live/lib/mcp-consent-session.test.ts`                                        |
| Port-agnostic loopback; built-in client; `clientId` on the session                            | `apps/mcp/src/oauth.test.ts`, `oauth-clients.test.ts`                                                                                                       |
| Device grant endpoints and polling answers                                                    | `apps/mcp/src/oauth-device.test.ts`, `apps/mcp/src/oauth.test.ts` (the built-in client)                                                                     |
| The device page trusts only the server's client name                                          | `apps/live/lib/mcp-device-session.test.ts`; `apps/live/e2e/clerk-stub/oauth-device.spec.ts` (dark scheme)                                                   |
| `tokens/current` read and revoke; session refused; any role revokes                           | `apps/api/src/routes/tokens.test.ts`                                                                                                                        |
| api-client and render-png extractions keep the MCP's behaviour                                | `packages/api-client/src/client.test.ts`; existing `apps/mcp` suites stay green                                                                             |

## Constants and configuration

| Constant                           | Value                  | Provenance                                  | Safe range         |
| ---------------------------------- | ---------------------- | ------------------------------------------- | ------------------ |
| `HELP_TOP_MAX_TOKENS`              | 500                    | Spec                                        | 400 to 600         |
| `HELP_RESOURCE_MAX_TOKENS`         | 250                    | Spec                                        | 150 to 300         |
| `HELP_VERB_MAX_TOKENS`             | 400                    | Spec                                        | 300 to 500         |
| `GUIDE_TOPIC_MAX_TOKENS`           | 1200                   | Research (agent-cli-ergonomics §4.2), CLI49 | 800 to 2000        |
| `SKILL_FRONTMATTER_MAX_TOKENS`     | 80                     | Spec "about 60"; research §4.2, CLI49       | 60 to 100          |
| `SKILL_BODY_MAX_TOKENS`            | 1500                   | Research §4.2, CLI49                        | 1000 to 2500       |
| `SCHEMA_KIND_MAX_TOKENS`           | 300                    | Research §4.2, CLI73                        | 200 to 500         |
| `TOKEN_EXPIRY_WARN_DAYS`           | 14                     | Spec                                        | 7 to 30            |
| `LIST_DEFAULT_LIMIT`               | 20                     | `find_documents`' default, CLI19            | 10 to 50           |
| `LIST_MAX_LIMIT`                   | 200                    | CLI19                                       | 50 to 500          |
| `ICON_SEARCH_MAX_LIMIT`            | 50                     | `find_documents`' maximum, CLI74            | 20 to 100          |
| `ICON_QUERY_MAX`                   | 60                     | The name cap, CLI74                         | 20 to 120          |
| `REF_MIN_PREFIX` (documents, tabs) | 4                      | The views' ref rule, CLI20                  | fixed by views     |
| `REQUEST_TIMEOUT_MS`               | 30000                  | CLI46                                       | 10000 to 120000    |
| `CAPABILITIES_CACHE_TTL_MS`        | 3600000                | CLI8                                        | 600000 to 86400000 |
| `HELD_RETRY_INTERVAL_MS`           | 2000                   | CLI25                                       | 500 to 10000       |
| `WAIT_HELD_MAX_S`                  | 3600                   | `WAIT_MAX_TIMEOUT_S`, CLI25                 | 600 to 86400       |
| `READ_COPY_REVS_PER_TAB`           | 3                      | CLI76                                       | 1 to 10            |
| `READ_COPY_MAX_BYTES`              | 33554432               | About 16 of the largest tabs, CLI76         | 8 MiB to 256 MiB   |
| `WAIT_DEFAULT_TIMEOUT_S`           | 600                    | CLI61                                       | 60 to 3600         |
| `WAIT_MAX_TIMEOUT_S`               | 3600                   | CLI61                                       | 600 to 86400       |
| `WAIT_SETTLE_MS`                   | 2000                   | One editor burst, CLI80                     | 500 to 10000       |
| `ROOM_RECONNECT_MIN_MS`            | 1000                   | CLI32                                       | 500 to 5000        |
| `ROOM_RECONNECT_MAX_MS`            | 30000                  | CLI32                                       | 10000 to 120000    |
| `EXPORT_CONCURRENCY`               | 2                      | Token read limit 120 a minute, CLI29        | 1 to 4             |
| `TELEMETRY_FLUSH_TIMEOUT_MS`       | 300                    | Research §9, CLI41                          | 100 to 1000        |
| `UPDATE_CHECK_INTERVAL_MS`         | 86400000               | Spec "once a day at most"                   | fixed by spec      |
| `UPDATE_CHECK_TIMEOUT_MS`          | 1500                   | CLI43                                       | 500 to 3000        |
| `LOGIN_TIMEOUT_MS`                 | 600000                 | The authorize session's 10-minute TTL       | equal to it        |
| `CLI_CLIENT_ID`                    | `livediagram-cli`      | MCP server §3                               | fixed              |
| `CLI_CLIENT_NAME`                  | `livediagram CLI`      | Spec (the token's name)                     | fixed              |
| `DEVICE_CODE_TTL_S`                | 600                    | The authorize session's TTL, CLI36          | 300 to 1800        |
| `DEVICE_POLL_INTERVAL_S`           | 5                      | RFC 8628 §3.2 default                       | 5 to 15            |
| `DEVICE_SLOW_DOWN_S`               | 5                      | RFC 8628 §3.5                               | fixed by RFC       |
| `USER_CODE_LENGTH`                 | 8                      | RFC 8628 §6.1 example, CLI36                | 8 to 10            |
| `USER_CODE_ALPHABET`               | `BCDFGHJKLMNPQRSTVWXZ` | RFC 8628 §6.1                               | fixed              |
| `DEVICE_AUTH_RATE_PER_HOUR`        | 20                     | `/oauth/register`'s per-IP cap              | 5 to 100           |
| `DEVICE_LOOKUP_RATE_MAX`           | 30 per 600 s per IP    | CLI36                                       | 10 to 100          |
| `CLI_PACKAGE_MAX_BYTES`            | 8388608                | CLI54                                       | 4 MiB to 16 MiB    |

Environment the CLI reads: `LIVEDIAGRAM_TOKEN`, `LIVEDIAGRAM_HOST`, `LIVEDIAGRAM_PROFILE`, `LIVEDIAGRAM_TELEMETRY`,
`DO_NOT_TRACK`, `LIVEDIAGRAM_NO_UPDATE_CHECK`, `LIVEDIAGRAM_DEBUG`, `CI`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`.
Api worker vars: `OAUTH_ISSUER` (hosted `https://mcp.livediagram.app`) and `CLI_MIN_VERSION` (unset until a
release needs a floor), in `[vars]` and `[env.staging.vars]` (staging `OAUTH_ISSUER` is the staging MCP origin), so
`pnpm staging:check` holds; both documented in `docs/operations/self-hosting.md`. No new secret, binding or migration.

## Assets and external resources

| Asset                         | Source                         | Licence | Path                                                                          |
| ----------------------------- | ------------------------------ | ------- | ----------------------------------------------------------------------------- |
| Inter Regular                 | rsms/inter, already vendored   | OFL 1.1 | `packages/render-png/fonts/` (moved); `dist/Inter-Regular.ttf`                |
| resvg wasm                    | `@resvg/resvg-wasm` 2.6.2      | MPL 2.0 | copied to `dist/resvg.wasm` by `build.mjs`                                    |
| Bundled dependencies' notices | each bundled package's licence | as each | `dist/THIRD_PARTY_LICENSES`, generated by `build.mjs` from esbuild's metafile |
| livediagram's licence         | repository `LICENSE`           | MIT     | `dist/LICENSE`                                                                |
| `@napi-rs/keyring` 2.1.0      | npm, optional dependency       | MIT     | installed by npm beside the package, never bundled                            |

`build.mjs` regenerates every `dist` file from the workspace; nothing in `dist` is committed.

## Defaults ledger

CLI1 to CLI85 in [DEFAULTS.md](DEFAULTS.md).
