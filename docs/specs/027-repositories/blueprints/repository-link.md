# Repository link: blueprint

Derived from [Repository link](../repository-link.md), with the commands, output, exit codes, read copies, room
stream and pull file of [CLI](../../015-api/cli.md) and its [blueprint](../../015-api/blueprints/cli.md), the
outline and header line of [Document views](../../024-agents/document-views.md) and its
[blueprint](../../024-agents/blueprints/document-views.md), the folder tree of
[Folders](../../013-workspace/folders.md) and [Team shared documents](../../013-workspace/team-shared-documents.md),
and the `Cli` category of [Telemetry](../../017-telemetry/telemetry.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `RLn`; the CLI blueprint's are cited as `CLIn`.

**This file covers the first build slice** (`plans/0046-workbench-live-diagram.md` phase 5): the link file, the
`none`, `index` and `files` mirror levels, `INDEX.md`, the mirror and outline files, the sync states with `ahead`
and `diverged` refused, `--relocate`, `--dry-run`, `--all`, the local sync state and its lock, `sync --watch`, and
`link init`, `link status` and `link ls`. The merge, offline pushes, the git hooks, the merge driver, `sync
--resolve`, pending proposals, base snapshots and diagram sources are the second slice: each is listed under
[Not in this slice](#not-in-this-slice). Where the spec leaves a rule of this slice open, the text says
**Open: Qn** and names the question in [Open questions](#open-questions); nothing there is guessed.

Scope, by file. "New" marks a file or symbol that does not exist yet; every other one exists today.

| File                                                     | Role                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/src/verbs/link.ts` (new)           | The local verbs `link.init`, `link.status`, `link.ls`, `sync`: schemas, descriptions, compact text, CLI projections (CLI55) |
| `packages/agent-verbs/src/catalogue.ts`                  | `VERBS` gains the four; `RESOURCES` gains `link`; `TOP_LEVEL` gains `sync`                                                  |
| `packages/agent-verbs/src/define.ts`                     | `Verb.telemetryType?: (input) => string` (new field, RL24)                                                                  |
| `packages/agent-verbs/src/verbs/document.ts`             | `documentRows(found, refs)` and `documentListText(...)` (new) extracted from `documentLs`, shared with `link.ls`            |
| `packages/agent-verbs/src/find-documents.ts`             | `readLibraries(api)` (new): personal documents and folders, each joined team's documents and folders, in one sweep          |
| `packages/document-views/src/index.ts`                   | Exports `headerLine` (new export of `header.ts`'s existing function), for `INDEX.md` at `index`                             |
| `apps/cli/src/link/link-file.ts` (new)                   | `LINK_FILE_NAME`, `LinkFile`, `MirrorLevel`, `parseLinkFile`, `linkFileText`, the link file's rejections                    |
| `apps/cli/src/link/find-links.ts` (new)                  | `nearestLink(io, cwd)`, `linksBelow(io, cwd)`                                                                               |
| `apps/cli/src/link/coverage.ts` (new)                    | `readCoverage(ctx, link)`: the covered documents with their folder paths, from `readLibraries` and the listed ids           |
| `apps/cli/src/link/mirror-file.ts` (new)                 | `mirrorFileText`, `hasConflictMarkers`, `MirrorFile`                                                                        |
| `apps/cli/src/link/mirror-scan.ts` (new)                 | `scanMirrorDir(io, link)`: every `*.livediagram.json` under `dir`, classified                                               |
| `apps/cli/src/link/mirror-paths.ts` (new)                | `folderPathSegments`, `mirrorPathFor`, `outlinePathOf`                                                                      |
| `apps/cli/src/link/sync-state.ts` (new)                  | `SyncState`, `syncStateOf` (pure)                                                                                           |
| `apps/cli/src/link/sync-plan.ts` (new)                   | `planSync` (pure): scan, coverage and remote facts to `SyncAction[]`                                                        |
| `apps/cli/src/link/sync-run.ts` (new)                    | `runSyncPass`: lock, plan, reads, writes, `INDEX.md`, report                                                                |
| `apps/cli/src/link/sync-watch.ts` (new)                  | `watchLink`: room streams, local watching, settle timers, one pass at a time                                                |
| `apps/cli/src/link/index-file.ts` (new)                  | `indexFileText`                                                                                                             |
| `apps/cli/src/link/outline-file.ts` (new)                | `outlineFileText`                                                                                                           |
| `apps/cli/src/link/markdown.ts` (new)                    | `markdownText`, `codeSpan`, `fenceFor`                                                                                      |
| `apps/cli/src/link/local-state.ts` (new)                 | `linkIdOf`, `linkStateDir`, `readLinkState`, `writeLinkState`, `saveReport`                                                 |
| `apps/cli/src/link/lock.ts` (new)                        | `acquireLinkLock`, `LinkLock`                                                                                               |
| `apps/cli/src/link/git.ts` (new)                         | `gitDirOf`, `gitMove`                                                                                                       |
| `apps/cli/src/link/constants.ts` (new)                   | The `SYNC_*` and `LINK_*` constants                                                                                         |
| `apps/cli/src/commands/link.ts` (new)                    | Handlers of `link init`, `link status`, `link ls`                                                                           |
| `apps/cli/src/commands/sync.ts` (new)                    | Handler of `sync`: one link, `--all`, `--watch`                                                                             |
| `apps/cli/src/commands/snapshot.ts` (new)                | `readDocumentSnapshot(ctx, documentId)`, extracted from `pull.ts`; `pull` and `sync` both read through it                   |
| `apps/cli/src/commands/pull.ts`                          | Reads through `readDocumentSnapshot`; its output is unchanged                                                               |
| `apps/cli/src/sync/pull-file.ts`                         | `PullSync.pulledAt` becomes optional; `parsePullFile` accepts it absent                                                     |
| `apps/cli/src/commands/pull-file-views.ts`               | `savedAt` of a file without `pulledAt` (RL10)                                                                               |
| `apps/cli/src/main.ts`                                   | Dispatch of the four verbs; `Cli·Used` type from `verb.telemetryType` when present                                          |
| `apps/cli/src/io.ts`, `node-io.ts`, `testing/fake-io.ts` | `CliFiles.list`, `move`, `createExclusive`, `realpath`; `CliIo.watchTree`, `pid`, `hostname`, `processAlive` (new members)  |
| `apps/cli/src/debug.ts`                                  | `debugLog(io, scope = 'cli')` (new parameter) so sync lines print as `[sync] …`                                             |
| `apps/cli/src/help/help.ts`                              | `GROUPED_ROWS` gains `sync` after `link`                                                                                    |
| `apps/cli/package.json`                                  | `smol-toml` 1.9.0 (new dependency, bundled; RL1)                                                                            |
| `apps/telemetry/app/cli-commands.ts`                     | `CLI_COMMANDS` rows `LinkInit`, `LinkStatus`, `LinkLs`, `Sync`, `SyncWatch`                                                 |
| `packages/agent-verbs/src/guides/index.ts`               | Unchanged in this slice; a `link` guide is not specified                                                                    |

## Domain and naming

| Term              | Identifier                                             | Meaning                                                                                   |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Repository link   | `LinkFile`, file `livediagram.toml` (`LINK_FILE_NAME`) | A directory bound to documents in livediagram                                             |
| Link root         | `LinkFile.root`                                        | The directory holding `livediagram.toml`                                                  |
| Link id           | `linkIdOf(path)`                                       | First 16 hex of SHA-256 of the link file's real path (RL8)                                |
| Coverage          | `Coverage`, `readCoverage`                             | The documents a link covers: its folder's subtree and its listed documents                |
| Covered document  | `CoveredDocument`                                      | One document in coverage, with its folder path                                            |
| Mirror level      | `MirrorLevel`: `none`, `index`, `files`                | How much a sync writes                                                                    |
| Mirror directory  | `LinkFile.mirror.dir`                                  | Where a sync writes, relative to the link root                                            |
| Mirror file       | `MirrorFile`, `<folder path>/<slug>.livediagram.json`  | A committed snapshot: a pull file with no time                                            |
| Outline file      | `<slug>.md`                                            | The snapshot's outline views, generated                                                   |
| Index file        | `INDEX.md`                                             | The covered documents and their tabs, generated                                           |
| Snapshot          | (the spec's word)                                      | What the mirror holds of a document at recorded revisions                                 |
| Sync              | `runSyncPass`; command `sync`                          | One pass comparing every covered document and acting on its state                         |
| Sync state        | `SyncState`                                            | One of `in-step`, `behind`, `ahead`, `diverged`, `new`, `local-new`, `gone`, `unreadable` |
| Sync action       | `SyncAction`                                           | What a pass does for one document or file                                                 |
| Local sync state  | `LinkState`, directory `linkStateDir`                  | Per link and work tree, never committed                                                   |
| Lock              | `LinkLock`, file `lock`                                | One pass at a time per link                                                               |
| Sync report       | `SyncReport`                                           | A pass's lines, kept in the local sync state                                              |
| Relocation        | `SyncAction` kind `relocate`                           | A mirror file whose path would now differ, moved by `--relocate`                          |
| Folder path       | `folderPathSegments`                                   | The folders between the covered folder and the document's folder                          |
| Transient failure | `SyncAction` kind `transient`                          | A read that failed for the network, a rate limit or a server failure                      |

Banned: "repo" in output (a repository), "mirror" for the link (the link is the binding; the mirror is the files),
"export" for a sync, "checkout" or "clone" for the local sync state, "conflict" for `diverged` (a conflict is git's
or a changeset's), "cache" for the local sync state in output (it is state, not a cache), "snapshot" for a read copy
(CLI blueprint), "orphan" for `local-new` or `unreadable`.

## Behaviour and state

### Finding the link

- **Nearest.** `nearestLink(io, cwd)` checks `<dir>/livediagram.toml` for `dir` = the working directory, then each
  parent up to the filesystem root; the first that exists is parsed. None exits 3 (`no_link`).
- **`--all`.** `linksBelow(io, cwd)` walks the working directory and its subdirectories, depth first in byte order
  of names, skipping `.git`, `node_modules` and every directory whose name starts with `.` (RL4), and returns every
  `livediagram.toml` found, the working directory's own included. None exits 3 (`no_link`). `--all` applies to
  `sync`, `link status` and `link ls` (the spec's "a command acts on the nearest … `--all` on every link below it");
  `link init` takes no `--all`.
- **Host.** After the profile is resolved (CLI blueprint step 3), a link whose `host` is not the profile's host
  (compared as origins, a leading `www.` ignored, as `parseDocumentUrl` compares) exits 2 (`host_mismatch`) naming
  the first profile in `config.toml` whose host is the link's, else `--host <link host>` (RL5). A link with no
  `host` uses the profile's. No request is sent before this check, so a self-host link never reaches
  livediagram.app (CLI blueprint I5).

### One sync pass (`runSyncPass`)

1. **Lock.** `acquireLinkLock` (below); `--dry-run` takes no lock and writes nothing at all, the local sync state
   included (RL13).
2. **Level.** `none`: the pass ends with `level none: nothing to write` and exit 0, reading nothing (Open: Q5 for
   what `link status` says at `none`).
3. **Coverage.** `readCoverage(ctx, link)` (below).
4. **Scan.** At `files`, `scanMirrorDir(io, link)` classifies every `*.livediagram.json` under `dir` (below). At
   `index`, no mirror file is read (Open: Q5, Q6).
5. **Remote facts.** For each covered document, and each scanned mirror file naming a document outside coverage:
   `GET /documents/:id?view=overview&json=1`, `SYNC_CONCURRENCY` at a time. The answer gives the document's name,
   `savedAt` and per tab the header facts (`ViewHeader`: name, kind, element counts, `rev`). `200` is readable;
   `410 document_trashed` is trashed; `404` is unreadable; `429`, `5xx`, a timeout or a network failure is
   transient; `401` ends the pass with exit 4 before anything is written (RL14).
6. **Plan.** `planSync(scan, coverage, remote, link)` gives one `SyncAction` per document and per refused file
   (below), in index order (Open: Q2).
7. **Act.** In plan order: relocations (with `--relocate`), then writes, then removals; each document's reads are
   `readDocumentSnapshot` (every tab's plain read with its `ETag` revision, in `orderIndex` order, as `pull` reads);
   each tab read is recorded as a read copy (CLI24, RL15).
8. **Index.** At `index` and `files`, `indexFileText(...)` is rendered and written only when its bytes differ from
   the file's (RL16).
9. **Report.** The action lines go to stdout, the report is saved (`saveReport`), `state.json` records each written
   tab's `rev` and `syncedAt`, and the lock is released. The exit code is the highest among the actions' codes
   (RL17).

A failure of one document never stops the pass for the others; a failure of the lock, the link file, the coverage
read or an `401` stops the whole pass before anything is written.

### Coverage (`readCoverage`)

- `readLibraries(api)`: `GET /documents`, `GET /folders`, `GET /teams`, and per joined team
  `GET /teams/:id/library` (`TeamLibraryResponse { folders, documents }`); a team failure degrades to no team
  documents, as `fetchTeamLibraries` does.
- **Folder.** The covered folder is the folder whose id equals `covers.folder` in the personal folders or a team
  library's folders. Its subtree is every folder whose `parentId` chain reaches it. A covered folder found in no
  library leaves its documents unknown: the pass reports `folder <id> is not readable by this account` once, and
  no mirror file is judged outside coverage in that pass (RL6).
- **Listed documents.** Each id in `covers.documents` is covered whatever its folder; its facts come from step 5.
- **Folder path.** `folderPathSegments(document)`: the names of the folders from the covered folder (exclusive) down
  to the document's folder (inclusive), each as `fileSlug(name, folderId)`; empty for a document directly in the
  covered folder and for a listed document outside the subtree (RL7).
- One document covered both ways is covered once.

### Scanning the mirror directory (`scanMirrorDir`)

Every regular file under `<root>/<dir>` whose name ends in `.livediagram.json`, walked as `linksBelow` walks,
skipping any subdirectory that holds its own `livediagram.toml` (that link's files are its own, RL4). Each is
classified, in this order:

| Classification | Test                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| `conflicted`   | `hasConflictMarkers(text)`: a line starting `<<<<<<< `, `=======` alone, or `>>>>>>> `    |
| `invalid`      | `parseDocumentEnvelope` fails, or `livediagramSync` is present and not a valid `PullSync` |
| `local-new`    | A valid envelope with no `livediagramSync` key                                            |
| `foreign-host` | `livediagramSync.host` is not the link's host (as origins, `www.` ignored)                |
| `tracked`      | A valid envelope with a valid `livediagramSync`, naming `document.id`                     |

Two `tracked` files naming one document id are both `duplicate` and refused (RL11).

### Sync states (`syncStateOf`)

For one `tracked` file of a document, with its recorded tabs `R` (`livediagramSync.tabs`), the file's tabs `F` and
the remote facts:

- **Local changed** when any tab in `F` has no entry in `R`, any entry in `R` has no tab in `F`, or any tab's
  `tabHashes` (`hash` or `settingsHash`) differs from its entry.
- **Remote changed** when the remote tab ids differ from `R`'s ids, or any remote tab's `rev` differs from its
  entry's `rev`.

| Remote answer | Coverage            | Local changed | Remote changed | State                             |
| ------------- | ------------------- | ------------- | -------------- | --------------------------------- |
| `200`         | covered             | no            | no             | `in-step`                         |
| `200`         | covered             | no            | yes            | `behind`                          |
| `200`         | covered             | yes           | no             | `ahead`                           |
| `200`         | covered             | yes           | yes            | `diverged`                        |
| `200`         | outside (RL6 aside) | any           | any            | `gone`                            |
| `410`         | any                 | any           | any            | `gone`                            |
| `404`         | any                 | any           | any            | `unreadable`                      |
| transient     | any                 | any           | any            | (none: the action is `transient`) |

- A covered document with no `tracked` file is `new` (deleting a file never deletes a document).
- A `local-new` file is `local-new`, whatever the api would answer for its `document.id`.
- `gone` of a file with local changes: Open: Q10 (the `gone` row removes the files; Principle 4 says a sync never
  overwrites a local change it has not sent).
- Open: Q3 (a document renamed with no tab revision changed is `in-step` by this table, so its file keeps the old
  name).

### Actions (`SyncAction`)

| State or class           | Action      | Effect                                                                                         | Exit |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------------------- | ---- |
| `in-step`                | `none`      | Nothing; the outline file is rewritten only when missing (RL12)                                | 0    |
| `behind`, `new`          | `write`     | `readDocumentSnapshot`; the mirror file at its path (below) and its outline file               | 0    |
| `ahead`                  | `refuse`    | Nothing written; `! <path>: changed here; send it: livediagram push <path>`                    | 1    |
| `diverged`               | `refuse`    | Nothing written; `! <path>: changed here and in livediagram; send it: livediagram push <path>` | 1    |
| `gone`                   | `remove`    | The mirror file and its outline file removed (a file with a local change: Open: Q10)           | 0    |
| `unreadable`             | `report`    | Nothing; one line per file, once per pass                                                      | 0    |
| `local-new`              | Open: Q7    | Open: Q7                                                                                       | Q7   |
| `conflicted`             | `refuse`    | Nothing; the line names `livediagram sync --resolve <path>` (Open: Q8)                         | 1    |
| `invalid`                | `refuse`    | Nothing; `! <path>: <parsePullFile message>`                                                   | 1    |
| `foreign-host`           | `refuse`    | Nothing; `! <path>: synced from <host>, not this link's <link host>`                           | 1    |
| `duplicate`              | `refuse`    | Nothing; `! <path>: names the same document as <other path>`                                   | 1    |
| transient                | `transient` | Nothing; `! "<name>": <failure>; files kept`                                                   | 6, 7 |
| a path that would differ | `relocate`  | Without `--relocate`: the line only; with it: moved before the pass writes                     | 0    |

A file that would be written is never also removed in one pass; a refused document's outline file is not
rewritten.

### Paths

- **New file.** `mirrorPathFor(document, folderPath, taken)`: `<dir>/<folder path>/<slug>.livediagram.json` with
  `slug = fileSlug(document.name, document.id)`; when that path is held by a file naming another document (or a
  `local-new` file), `<slug>-<idSlug(id)>`, then the whole id (CLI27, CLI85).
- **Stable.** A `tracked` file keeps its path on every later write. Its **expected path** is `mirrorPathFor` with
  the document's current name and folder path, its own path excluded from `taken`. A different expected path is a
  `relocate` action.
- **Relocate** (`--relocate`): inside a git work tree `gitMove(root, from, to)` runs `git -C <root> mv <from> <to>`
  for the mirror file and its outline file; a file git does not track, or a work tree without git, is moved with
  `CliFiles.move` (RL9). Parent directories are created; a directory left empty is removed.
- **Outline file.** `outlinePathOf(mirrorPath)`: the mirror path with `.livediagram.json` replaced by `.md`.
- **Index file.** `<root>/<dir>/INDEX.md`.

### The lock (`acquireLinkLock`)

- `CliFiles.createExclusive('<state dir>/lock', JSON)` (an `O_EXCL` create) with
  `{ pid, hostname, startedAt, command }`.
- Held: re-read the holder; a holder on this `hostname` whose `pid` is not alive (`processAlive`) is stale and
  removed, then the create retried once (RL34). Otherwise poll every `SYNC_LOCK_POLL_MS`, logging
  `[sync] lock-wait <pid>` once, until `SYNC_LOCK_WAIT_MS` has passed since the first attempt, then exit 5
  (`lock_held`) naming the pid (RL18).
- Released in a `finally` after the pass, on every path; `sync --watch` holds it per pass, never between passes
  (RL19).

### `sync --watch` (`watchLink`)

| From     | Event                                                              | To       | Effect                                                                                                                                                |
| -------- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| start    | invoked                                                            | passing  | One full pass; then one room stream per covered document (`openRoomStream`)                                                                           |
| idle     | a room op on a covered document (`classifyRoomOp`, any event)      | settling | That document's settle timer reset to `WAIT_SETTLE_MS` (RL20)                                                                                         |
| settling | the timer fires                                                    | passing  | A pass narrowed to that document, then `INDEX.md`                                                                                                     |
| idle     | a local change under `dir` to a `*.livediagram.json` (`watchTree`) | settling | That path's timer reset to `SYNC_LOCAL_SETTLE_MS`                                                                                                     |
| settling | the local timer fires                                              | passing  | A pass narrowed to that file; `ahead` or `diverged` refused as in a pass                                                                              |
| idle     | `SYNC_WATCH_COVERAGE_MS` passes                                    | passing  | Coverage re-read; documents that entered get a stream and a pass; documents that left are passed (they become `gone`) and their stream stopped (RL21) |
| any      | a room stream reconnects                                           | settling | A pass of that document is due, as for an op (RL22)                                                                                                   |
| any      | a room stream ends `trashed`                                       | passing  | A pass of that document (it is `gone`); its stream is dropped                                                                                         |
| any      | a room ticket is refused (`ApiError` below 500)                    | passing  | A pass of that document (`unreadable` or `gone` decides); its stream dropped                                                                          |
| passing  | a timer fires                                                      | passing  | Queued: passes run one at a time, in arrival order, merged per document                                                                               |
| any      | SIGINT                                                             | stopped  | Every stream stopped, every timer cancelled, the running pass finished, exit 0                                                                        |

- **Own writes.** Each path the watch writes or removes is remembered with the SHA-256 of what it wrote (or
  removal); a local event whose file now hashes to that value is ignored (RL23).
- **Output.** One stdout line per pass: `<HH:MM:SS> ` (UTC) followed by the pass's action lines joined with
  `·`, or `in step` when it did nothing (RL25). A refusal or `unreadable` line is printed in the first pass that
  meets it and again only after it changed.
- At `none`, `sync --watch` exits 0 after the first pass's line.

### `link init`

1. A `livediagram.toml` in the working directory exits 1 (`link_exists`).
2. `--folder <f>` resolves as a folder: a full id, an id prefix of at least `REF_MIN_PREFIX` characters, or a name
   equal ignoring case, across personal and team folders; none exits 3 with the nearest names, several exit 3
   with the candidates (`<ref>  "<path>"  <library>`) (RL26).
3. Each `--doc <d>` resolves with `resolveDocument` (CLI blueprint "Addressing"); a share-link URL exits 2 (a link
   file holds ids, and a share code is not one) (RL27).
4. Neither `--folder` nor `--doc`: Open: Q1.
5. `--level` is one of `none`, `index`, `files`; absent writes no `[mirror]` table (the defaults apply).
6. `linkFileText(...)` is written atomically (CLI blueprint, temporary file then rename); stdout prints the path.
7. The public remote line: Open: Q10.

### `link status` and `link ls`

- `link status`: steps 1 to 6 of a pass without the lock and without writing; prints one line per document and
  per refused file, then the totals line. Exit: Open: Q4. At `index` and `none`: Open: Q5.
- `link ls`: coverage only (`readCoverage` plus step 5's reads for listed documents); prints the readable covered
  documents with `documentListText`, as `document ls` prints them. A listed document answered `404` is named on
  stderr, `unreadable: <id>`; exit 0.

## Interfaces and contracts

### The link file

Parsed with `smol-toml`'s `parse` (RL1); then validated by `parseLinkFile(text, path): LinkFile`, which throws
`CliError` with the codes below.

```ts
type MirrorLevel = 'none' | 'index' | 'files';
type LinkFile = {
  path: string; // the real path of livediagram.toml
  root: string; // its directory
  host: string | null; // an origin; null: the active profile's
  covers: { folder: string | null; documents: string[] };
  mirror: { level: MirrorLevel; dir: string }; // dir: normalised, POSIX separators, relative to root
  hooks: { block: boolean }; // validated; read by the git slice
  sources: Record<string, unknown>[]; // [[sources]], owned by diagram-sources; unread in this slice (RL2)
};
```

| Key                | Type             | Default    | Rule                                                                                                                           |
| ------------------ | ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `host`             | string           | absent     | An `http:` or `https:` URL whose path is `/` or empty, no query or fragment; stored as its origin                              |
| `[covers]`         | table            | absent     | Required in effect: `folder`, `documents` or both                                                                              |
| `covers.folder`    | string           | absent     | Non-empty, no whitespace, at most `LINK_ID_MAX` characters (RL3)                                                               |
| `covers.documents` | array of strings | `[]`       | Each as `folder`; no duplicates                                                                                                |
| `[mirror]`         | table            | defaults   |                                                                                                                                |
| `mirror.level`     | string           | `index`    | `none`, `index` or `files` (spec)                                                                                              |
| `mirror.dir`       | string           | `diagrams` | Relative; normalised; not empty after normalisation; no `..` segment; its real path inside the link root's (spec default; RL3) |
| `[hooks]`          | table            | defaults   |                                                                                                                                |
| `hooks.block`      | boolean          | `false`    | Validated; unused in this slice (RL2)                                                                                          |
| `[[sources]]`      | array of tables  | `[]`       | Only its shape is checked; its tables' keys are diagram-sources' (RL2)                                                         |

Rejections (`error:` lines are final copy; each ends with its `hint:`):

| Code                 | Exit | `error:`                                                                                                | `hint:`                                                   |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `no_link`            | 3    | `no livediagram.toml in <cwd> or above` (`below` with `--all`)                                          | `livediagram link init --folder <folder>`                 |
| `link_syntax`        | 2    | `<path> line <l>, column <c>: <smol-toml message>`                                                      | `fix the line; livediagram.toml is TOML`                  |
| `unknown_key`        | 2    | `<path>: unknown key "<table>.<key>"`, then `did you mean: <x>` (CLI51) when near                       | `the keys of [<table>]: <keys>`                           |
| `wrong_type`         | 2    | `<path>: <table>.<key> must be <a string\|an array of strings\|a boolean\|a table\|an array of tables>` | `livediagram link init --help`                            |
| `invalid_host`       | 1    | `<path>: host must be an origin such as https://livediagram.app, not <value>`                           | none                                                      |
| `no_coverage`        | 1    | `<path>: [covers] needs a folder, documents, or both`                                                   | `livediagram link init --folder <folder>`                 |
| `empty_id`           | 1    | `<path>: <key> holds an empty or spaced id`                                                             | `livediagram link ls`                                     |
| `duplicate_document` | 1    | `<path>: covers.documents lists <id> twice`                                                             | none                                                      |
| `invalid_level`      | 1    | `<path>: mirror.level must be none, index or files, not "<value>"`                                      | none                                                      |
| `invalid_dir`        | 1    | `<path>: mirror.dir must stay inside <root>, not "<value>"`                                             | none                                                      |
| `host_mismatch`      | 2    | `<path> links <link host>; this profile is <profile host>`                                              | `livediagram --profile <name> …`, or `--host <link host>` |
| `link_exists`        | 1    | `<path> already exists`                                                                                 | `edit it, or run link init in another directory`          |
| `lock_held`          | 5    | `another sync of <path> is running (process <pid>)`                                                     | `wait for it, or stop process <pid>`                      |

Unknown keys are refused at every level the spec names (top level, `[covers]`, `[mirror]`, `[hooks]`); a key
inside a `[[sources]]` table is diagram-sources' to judge (RL2).

`linkFileText({ host, folder, documents, level })`, final copy, keys in this order, LF endings:

```toml
# This repository's diagrams live in livediagram; see <host>/help/developers/repositories/
host = "<host>"

[covers]
folder = "<folder id>"
documents = ["<id>", "<id>"]

[mirror]
level = "<level>"
```

`host` is always written (RL28); `folder`, `documents` and `[mirror]` only when given.

### The verbs (`packages/agent-verbs/src/verbs/link.ts`)

All `local: true` (CLI55); `sync` and `link.status` are `files: true` (they read mirror files, so a host storing a
newer document format refuses them, CLI blueprint step 6).

| Verb          | Behaviour | Input                                                      | Output                                                    | `cli.prints`                                          |
| ------------- | --------- | ---------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `link.init`   | write     | `folder?: string`, `doc?: string[]`, `level?: MirrorLevel` | `{ path }`                                                | `the path written`                                    |
| `link.status` | read      | `all?: boolean`                                            | `{ links: { path, rows: StatusRow[], totals }[] , exit }` | `one line per document: state, ref, name, file`       |
| `link.ls`     | read      | `all?: boolean`, `limit` as `document.ls`                  | `{ documents, more }` (the `document.ls` shape)           | `one document a line: ref, name, library, last saved` |
| `sync`        | write     | `watch?`, `relocate?`, `dryRun?`, `all?`: booleans         | `{ lines: string[], exit }`                               | `one line per document acted on, then the totals`     |

- `sync` with `--watch` and `--dry-run` together exits 2 (`--dry-run writes nothing, so there is nothing to
watch`) (RL29).
- `sync.telemetryType = (input) => (input.watch ? 'SyncWatch' : 'Sync')` (RL24).
- Descriptions (final copy):
  - `link.init`: `Writes livediagram.toml in the current directory, linking it to a folder, documents, or both.`
  - `link.status`: `Prints every document the link covers with its sync state, and every mirror file a sync would refuse.`
  - `link.ls`: `Lists the documents the link covers, as document ls lists them.`
  - `sync`: `Writes the link's documents into the repository at its mirror level: INDEX.md, and at files a mirror file and an outline file per document. --watch keeps syncing until Ctrl-C.`
- Examples: `livediagram link init --folder "Minigames" --level files`, `livediagram link init --doc 3f9c`;
  `livediagram link status`, `livediagram link status --all`; `livediagram link ls`, `livediagram link ls --json`;
  `livediagram sync`, `livediagram sync --watch`.
- Summaries: `link.init` `Write livediagram.toml for this directory`; `link.status` `Each covered document's sync
state`; `link.ls` `The documents the link covers`; `sync` `Mirror the link's documents into the repository`.
- `RESOURCES` gains `{ name: 'link', summary: 'Repository links: livediagram.toml and what it covers' }` after
  `graph`; `TOP_LEVEL` gains `sync`; `GROUPED_ROWS` gains `{ words: ['sync'], after: 'link', summary: 'mirror a
link's documents into the repository' }`.

### CliIo additions

```ts
type CliFiles = {
  // ...today's members
  // Entries of a directory, or null when it is not one; symbolic links reported as 'link' and never followed.
  list(path: string): Promise<{ name: string; kind: 'file' | 'dir' | 'link' }[] | null>;
  move(from: string, to: string): Promise<void>; // rename(2); parent directories created
  createExclusive(path: string, data: string): Promise<boolean>; // false when the path exists
  realpath(path: string): Promise<string | null>;
};
type CliIo = {
  // ...today's members
  // Recursive change events under `dir` (node:fs watch, recursive); the returned function stops it.
  watchTree(dir: string, onChange: (path: string) => void): () => void;
  pid: number;
  hostname: string;
  processAlive(pid: number): boolean; // process.kill(pid, 0) without ESRCH
};
```

`fakeIo` gains the same over its file map, with a `touch(path)` that fires `watchTree` handlers.

### The mirror file

```ts
type MirrorFile = PullFile & { livediagramSync: Omit<PullSync, 'pulledAt'> }; // no exportedAt, no pulledAt
```

`mirrorFileText(file)` (byte exact): the envelope `{ kind, schemaVersion, document, livediagramSync }` with no
`exportedAt` (RL30) and every object's keys sorted at every depth (`canonicalJson`'s order, RL31), printed with
two-space indentation as `JSON.stringify(value, null, 2)` prints, except that each array at
`document.tabs[i].elements` prints one element per line: its `canonicalJson`, indented to the array's depth plus
two, a comma after every element but the last; an empty array prints `[]`. LF line endings, one trailing `\n`.

```json
{
  "document": {
    "id": "3h9x2a5e-…",
    "name": "Home screen",
    "presentation": null,
    "tabs": [
      {
        "elements": [
          {
            "height": 60,
            "id": "play",
            "label": "Play button",
            "type": "shape",
            "width": 160,
            "x": 0,
            "y": 0
          },
          { "from": "play", "id": "a1", "to": "menu", "type": "arrow" }
        ],
        "id": "0b34…",
        "name": "Flow",
        "rev": 17
      }
    ]
  },
  "kind": "livediagram.document",
  "livediagramSync": {
    "host": "https://livediagram.app",
    "tabs": {
      "0b34…": {
        "hash": "…",
        "rev": 17,
        "settingsHash": "…"
      }
    }
  },
  "schemaVersion": 1
}
```

- The tab objects are the plain tabs as `readDocumentSnapshot` reads them (what `pull` writes), each with its
  per-document `folder` when it has one.
- `hash` and `settingsHash` are `tabHashes(tab)` of the tab as written, so the same tab at the same revision writes
  the same bytes.
- Compatibility: `parseDocumentEnvelope` reads it (`exportedAt` absent reads as 0), so "Import a copy" reads it;
  `parsePullFile` reads it once `pulledAt` is optional; `push <mirror file>` works unchanged and, when it lands,
  rewrites the file with `pullFileText` (two-space JSON, no per-line elements). Such a file is still `tracked` and
  hashes alike; the next sync that writes it restores the canonical form (spec "Formatting is not meaning").
- `push` writes no `pulledAt` into a file that had none: `pushFile` spreads the parsed `livediagramSync` back, so
  an absent key stays absent.
- Every command that takes a pull file's path (CLI70) takes a mirror file's path alike.

### The outline file

`outlineFileText(document, tabs, host)`, byte exact, LF endings:

````markdown
> Generated by `livediagram sync`; do not edit. Edit this document in livediagram: <host>/document/<id>

# <markdownText(document name)>

## <markdownText(tab name)>

```text
<renderView({ view: 'outline', door: 'cli' }, tab, { rev, tabIds }).text>
```
````

One `##` section per tab in the file's tab order, a blank line between sections, one trailing `\n`. The fence is
`fenceFor(text)`: three backticks, or one more than the longest backtick run in the text (RL32). No budget is
passed, so the outline is whole. `rev` is the tab's recorded revision; `tabIds` the file's tab ids in order.

### `INDEX.md`

`indexFileText(link, documents, level, host)`, byte exact, LF endings, one trailing `\n`:

```markdown
> Generated by `livediagram sync` from `<path of livediagram.toml relative to dir>`; do not edit. Edit the diagrams in livediagram: <host>

# Diagrams

<n> documents · level <level>

## <markdownText(document name)>

- Link: <host>/document/<id>
- Folder: <space>/<folder>/<subfolder>
- Files: `<mirror path relative to dir>`, `<outline path relative to dir>`
- Tabs:
  - <markdownText(tab name)> · <kind> · <n> elements · rev <rev>
```

- At `index` each tab line is followed by `    ` (four spaces) and `codeSpan(headerLine(facts))`: the outline's
  header line, built from the overview's facts, so `rg` finds tab names and counts (spec).
- At `index` the `Files:` line is left out.
- `<space>` is `My documents` for a personal folder, the team's name for a team folder; a listed document whose
  folder this account cannot see shows `Shared with me` (RL7).
- `<n> elements` is the header facts' `elements` (`1 element` when one).
- A document whose action is `unreadable`, `transient` or refused keeps its previous section verbatim when the
  previous `INDEX.md` holds one (located by its `Link:` line); otherwise it is left out (RL16).
- No covered document: the totals line is `0 documents · level <level>` and no `##` section follows.
- Document order: Open: Q2.

`markdownText(s)` backslash-escapes ``\ ` * _ [ ] < > # | ~`` and a leading `+`, `-` or `<digits>.`; `codeSpan(s)`
wraps in a backtick run one longer than the longest inside, padded with a space when `s` starts or ends with a
backtick (RL32).

### Output lines (stdout)

`sync`, in plan order, final copy (`<path>` relative to the working directory, POSIX separators):

| Action        | Line                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| write, new    | `+ <path>  "<name>" · <n> tabs · rev <r>[,<r>…]`                                                                                   |
| write, behind | `~ <path>  "<name>" · <tab names changed, comma-separated> · rev <a>→<b>[, …]`                                                     |
| remove        | `- <path>  "<name>" · in the Trash` or `· outside the link`                                                                        |
| relocate      | `» <path> → <expected path>` (with `--relocate`); else `» <path> would move to <expected>: livediagram sync --relocate`            |
| unreadable    | `? <path>: no document this account can open; left as it is`                                                                       |
| refuse        | as in the actions table                                                                                                            |
| transient     | `! "<name>": <could not reach <host> (<code>)\|<host> failed (HTTP <status>)\|<host> is rate limiting this token>; files kept`     |
| index         | `~ <dir>/INDEX.md` when rewritten                                                                                                  |
| totals        | `<n> in step · <n> written · <n> removed · <n> refused · <n> unreadable` (zero counts left out; `nothing to do` when all are zero) |

`--dry-run` prints the same lines and then `dry run: nothing written`. `--all` prints `<link path>` before each
link's lines and a blank line between links.

`link status` rows, aligned with `columns`: `<state>  <ref>  "<name>"  <path>`; a file with no readable document
prints `<state>  -  <path>`; then the totals line `<n> in-step · <n> behind · …` in state-table order, zero counts
left out.

## Data and persistence

No api change, no D1 table, no migration. Local files:

| File                                                 | Class   | Notes                                                                                              |
| ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `<root>/livediagram.toml`                            | config  | Committed; written only by `link init`                                                             |
| `<root>/<dir>/INDEX.md`                              | derived | Committed; rewritten when its bytes differ                                                         |
| `<root>/<dir>/<folder path>/<slug>.livediagram.json` | content | Committed; the snapshot; the person's local changes are proposals                                  |
| `<root>/<dir>/<folder path>/<slug>.md`               | derived | Committed; rendered from the mirror file                                                           |
| `<state dir>/state.json`                             | state   | `{ version: 1, linkPath, tabs: { "<documentId>/<tabId>": { rev, syncedAt } } }`                    |
| `<state dir>/lock`                                   | state   | `{ pid, hostname, startedAt, command }`; present only while a pass runs                            |
| `<state dir>/reports/<startedAt>-<pid>.json`         | content | `{ version: 1, startedAt, finishedAt, command, lines, exit }`; the newest `SYNC_REPORTS_KEPT` kept |
| `<state dir>/bases/`, `<state dir>/pending/`         | content | Reserved for base snapshots and pending proposals; written by the second slice, never in this one  |

- **State dir** (`linkStateDir`): `git -C <root> rev-parse --absolute-git-dir` (each worktree answers its own);
  success gives `<git dir>/livediagram/<link id>/`; a missing `git`, a non-zero exit or no work tree gives
  `<cacheDir>/links/<link id>/` (`cacheDir` honours `XDG_CACHE_HOME`, CLI5; the spec's `~/.cache/livediagram`
  when unset). Directories 0700, files 0600 (reports hold names and paths) (RL8).
- Every write is a temporary file in the same directory then a rename (`CliFiles.write`). A missing, unreadable or
  wrong-version `state.json` starts empty and is rewritten; it decides nothing a mirror file decides (states come
  from the files and the api only).
- **Snapshot and restore.** A fresh clone has the committed files and an empty state: the first sync reads the
  recorded revisions from the mirror files themselves, so nothing is lost but `syncedAt`.
- **Migration.** A pull file moved into `dir` by hand is `tracked` (it has `livediagramSync`); its `pulledAt` and
  `exportedAt` go at its next write.

## Errors and edge cases

- **E1** No link at or above: exit 3 `no_link`.
- **E2** A link file inside the mirror directory of another link: each link scans its own `dir` and skips
  subdirectories holding a `livediagram.toml` (RL4).
- **E3** Two links covering one document: each keeps its own file, its own state dir and its own lock (spec).
- **E4** A mirror file reformatted by a formatter: hashes alike (`canonicalJson`), stays `in-step`, not rewritten.
- **E5** A mirror file edited into invalid JSON: `invalid`, refused, exit 1; the document's other files untouched.
- **E6** A mirror file with git's conflict markers: `conflicted`, refused, exit 1 (Open: Q8 for the hint).
- **E7** A covered document whose mirror file was deleted: `new`, written again at a fresh path.
- **E8** A document moved to the Trash: `410`, `gone`, files removed; restoring it makes it `new` again.
- **E9** A document purged, or not this account's to open: `404`, `unreadable`, untouched, one line per pass.
- **E10** The covered folder deleted: its documents move up to its parent (Folders spec) and leave coverage; with
  the folder no longer found, RL6 applies: the pass says so and judges nothing outside coverage.
- **E11** Offline mid-pass: the documents read so far are written, the rest are `transient`, exit 7; `INDEX.md`
  keeps the unread documents' previous sections (RL16).
- **E12** Rate limited (`429`): `transient`, exit 6; no retry inside the pass (RL14).
- **E13** A tab read answered without a revision: that document is `transient` with `the host named no revision
for tab "<name>"`, exit 7 (as `pull`).
- **E14** A tab changed between the overview read and the tab read: the tab read's `ETag` revision is recorded, so
  the file says exactly what it holds.
- **E15** `diverged` on one tab and `ahead` on another of the same document: one `refuse` for the document;
  `livediagram push <path>` then lands the `ahead` tab and names the other `! stale tab` (CLI blueprint "Pull and
  push"); the stale tab waits for the merge (second slice).
- **E16** A relocation target held by another document's file: `-<id8>`, then the whole id (CLI27, CLI85).
- **E17** `git mv` refusing (untracked file, index locked): falls back to `CliFiles.move`; a failure of both is
  `transient`-like: the line names the error, exit 7, nothing else moves for that document.
- **E18** `mirror.dir` a symbolic link out of the link root: `invalid_dir` (its real path is outside), exit 1.
- **E19** A lock left by a crashed sync on this machine: stale, taken over with `[sync] lock stale <pid>` (RL34).
- **E20** A lock held by another machine sharing the directory (a network drive): never judged stale; exit 5 after
  `SYNC_LOCK_WAIT_MS`.
- **E21** `--watch` over a document whose room ticket is refused: one pass decides `unreadable` or `gone`; the
  stream is dropped, the watch goes on.
- **E22** An editor saving through a temporary file and a rename: one `watchTree` event per path, settled by
  `SYNC_LOCAL_SETTLE_MS`.
- **E23** A host storing a newer document format: `sync` and `link status` exit 1 as `pull` does (CLI blueprint
  step 6).
- **E24** A covered document with zero tabs: written with `"tabs": []`, its outline file holds the heading line
  only.
- **E25** Two documents of one name in one folder: the second's slug takes `-<id8>`.
- **E26** A view-level token: reads succeed, nothing is sent in this slice anyway; the spec's one-way rule is met.

## Security and trust

- The link file holds ids and settings only; no command writes a credential into it or into a mirror, outline or
  index file. A share code is never written (`--doc` with a share link exits 2, RL27).
- **Writes stay inside the link.** Every path a sync writes, moves or removes is under the real path of
  `<root>/<dir>`; `dir` with `..`, absolute, or resolving outside the root is `invalid_dir`. A sync removes only
  files it classified as `tracked` mirror files of a `gone` document and their `<slug>.md` siblings.
- **Never follows symbolic links** inside `dir` while scanning (`CliFiles.list` reports them as `link`), so a
  hostile repository cannot point a scan at the home directory.
- **Host.** A link's requests go to the profile's host only after the host check; a self-host link never contacts
  livediagram.app (CLI blueprint I5).
- **Access.** Each sync reads with the syncing person's credential: `unreadable` documents are never written,
  overwritten or removed, so one teammate's sync never erases what another may read.
- **Debug lines** carry ids and states only, never names, paths or content (spec).
- The local sync state is per user (0700 / 0600) and inside `.git` or the user's cache, never in the work tree.

## Performance and limits

- **Requests per pass.** Coverage: `3 + teams` reads. Per covered document: one overview read. Per written
  document: one plain read per tab. A folder of 50 documents in step costs about 55 requests, within the token
  read limit of 120 a minute; `SYNC_CONCURRENCY` keeps a pass from bursting it.
- **Local work.** One parse and two SHA-256 hashes per mirror tab per pass; a 1.9 MB tab hashes in well under
  50 ms.
- **Watch.** One socket per covered document (the room stream sends no frames); one coverage re-read per
  `SYNC_WATCH_COVERAGE_MS`; one pass at a time.
- **Files.** A mirror file is the tab's JSON plus one newline per element; the outline file is about a tenth of it
  (spec); `INDEX.md` grows by about six lines per document and one or two per tab.

## Presentation and UX

- **stdout carries data only** (CLI blueprint I1): the action lines, status rows and totals. Notices
  (`folder <id> is not readable by this account`, `unreadable: <id>`) go to stderr.
- **No colour, no spinner** (CLI47); the marks `+ ~ - » ! ?` always come with words.
- Final copy is in "Output lines", the rejection table, `linkFileText`, `outlineFileText` and `indexFileText`.
- **Help.** `link --help` within `HELP_RESOURCE_MAX_TOKENS`, each verb's help within `HELP_VERB_MAX_TOKENS`, and the
  top help with the new `link` row and `sync` grouped row within `HELP_TOP_MAX_TOKENS`, all checked by
  `help.test.ts`.
- `link init` with no folder: Open: Q1. `INDEX.md` order: Open: Q2.

## Accessibility

- Terminal output as the CLI's: plain lines read once by a screen reader, meaning never carried by colour.
- `INDEX.md` and the outline files use one `#` heading, then `##` per document or tab, so a screen reader on a
  forge's Markdown view navigates by heading; links are written as bare URLs, readable as text.

## Observability

Printed to stderr only under `LIVEDIAGRAM_DEBUG=1`, as `[sync] …` (`debugLog(io, 'sync')`, RL33). Ids only.

| Fingerprint                                                                                      | Where                     |
| ------------------------------------------------------------------------------------------------ | ------------------------- |
| `[sync] link <link id> level <level> folder <id\|-> documents <n>`                               | pass start                |
| `[sync] coverage <n> covered folder <found\|unreadable>`                                         | `readCoverage`            |
| `[sync] state <documentId> <state>`                                                              | `planSync`, each document |
| `[sync] wrote <documentId> <tabId> rev <n>`                                                      | each tab written          |
| `[sync] gone <documentId> <trashed\|outside>`                                                    | each removal              |
| `[sync] unreadable <documentId>`                                                                 | each `404`                |
| `[sync] refused <documentId\|-> <ahead\|diverged\|conflicted\|invalid\|foreign-host\|duplicate>` | each refusal              |
| `[sync] transient <documentId> <status\|network>`                                                | each transient failure    |
| `[sync] relocate <documentId> <moved\|pending> <git\|rename>`                                    | each relocation           |
| `[sync] lock <taken\|released\|stale <pid>>`, `[sync] lock-wait <pid>`                           | the lock                  |
| `[sync] watch <room <documentId>\|local\|coverage> settled`                                      | `watchLink`               |
| `[sync] pass <n> actions exit <code> <ms> ms`                                                    | pass end                  |

The spec's `[sync] sent`, `merged`, `lost-local-value`, `pending` and `resolved` belong to the second slice. The
room stream's own `[cli] room …` lines and each request's `[cli] request …` line print as today.

## Testing

Every suite runs on `fakeIo` and `fakeApi` with a fixed clock; none waits on a real timer, the network, git or the
file system, except `git.test.ts`, which runs a real `git` in a temporary directory and is skipped when `git` is
absent.

| Spec rule                                                                                        | Test                                                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| The link file: every key, its defaults (`index`, `diagrams`), types                              | `apps/cli/src/link/link-file.test.ts`                                             |
| Covers needs a folder, documents or both                                                         | `link-file.test.ts` (`no_coverage`)                                               |
| Unknown keys refused by name at every level; `[[sources]]` contents not judged                   | `link-file.test.ts` (one case per table; did-you-mean)                            |
| Every rejection of the table, with its exit and copy                                             | `link-file.test.ts` (table-driven over the rejection table)                       |
| `mirror.dir` stays inside the link root, symbolic links included                                 | `link-file.test.ts`, `apps/cli/src/commands/sync.test.ts` (E18)                   |
| `link init` writes the file byte for byte; refuses an existing one; resolves folder and docs     | `apps/cli/src/commands/link.test.ts`                                              |
| Nearest link at or above; `--all` below, skipping hidden, `node_modules`, nested links' dirs     | `apps/cli/src/link/find-links.test.ts`                                            |
| Host absent is the profile's; another host refused naming the profile; no request before         | `apps/cli/src/commands/sync.test.ts` (fetch log empty on refusal)                 |
| Coverage: folder subtree in personal and team libraries; listed documents anywhere; folder path  | `apps/cli/src/link/coverage.test.ts`                                              |
| Mirror level `none` writes nothing                                                               | `sync.test.ts`                                                                    |
| `index` writes `INDEX.md` only, with each tab's header line                                      | `sync.test.ts`; `apps/cli/src/link/index-file.test.ts` (golden)                   |
| `files` writes `INDEX.md`, a mirror file and an outline file per document                        | `sync.test.ts`                                                                    |
| `INDEX.md` opens with the generated line; sections as specified                                  | `index-file.test.ts` (golden, `__fixtures__/INDEX.index.md`, `INDEX.files.md`)    |
| Mirror file: one element per line, keys sorted, no time, deterministic bytes                     | `apps/cli/src/link/mirror-file.test.ts` (golden; written twice, byte-equal)       |
| The editor's import reads a mirror file; `parsePullFile` reads it                                | `mirror-file.test.ts` (`parseDocumentEnvelope`, `parsePullFile`)                  |
| `push` and pull-file views work on a mirror file; `pulledAt` stays absent                        | `apps/cli/src/commands/pull-push.test.ts`, `export-views.test.ts`                 |
| `pull` unchanged after the `readDocumentSnapshot` extraction                                     | `pull-push.test.ts` (existing cases stay green)                                   |
| Formatting is not meaning: a reformatted file is `in-step` and untouched                         | `apps/cli/src/link/sync-state.test.ts`, `sync.test.ts`                            |
| Outline file: generated line with the link, one section per tab, `text` fence                    | `apps/cli/src/link/outline-file.test.ts` (golden; a label with backticks)         |
| The slug stays; a path that would differ is named; `--relocate` moves through `git mv`           | `sync.test.ts`; `apps/cli/src/link/git.test.ts` (real git, tracked and untracked) |
| Every state of the state table                                                                   | `sync-state.test.ts` (table-driven, one row per state)                            |
| `in-step` does nothing; `behind` and `new` write                                                 | `apps/cli/src/link/sync-plan.test.ts`, `sync.test.ts`                             |
| A deleted mirror file is `new`; deleting never deletes a document                                | `sync.test.ts` (no `DELETE` request ever sent)                                    |
| `gone`: `410`, or readable and outside coverage; files removed                                   | `sync-plan.test.ts`, `sync.test.ts`                                               |
| `unreadable`: `404` touches nothing, reported once per pass                                      | `sync.test.ts`                                                                    |
| Only an envelope without sync data is `local-new`; a tracked file is never created               | `apps/cli/src/link/mirror-scan.test.ts`, `sync-plan.test.ts`                      |
| Transient failures keep files and are reported, never `gone` or `unreadable`                     | `sync.test.ts` (429, 503, network; files byte-equal after)                        |
| Conflict markers refused naming the command                                                      | `mirror-scan.test.ts`, `sync.test.ts`                                             |
| `ahead` and `diverged` refused per document naming `push <file>`; the rest proceeds              | `sync.test.ts`                                                                    |
| `--dry-run` writes nothing, takes no lock                                                        | `sync.test.ts` (file map and state dir unchanged)                                 |
| Local sync state under the git dir, else the cache; link id from the path; each worktree its own | `apps/cli/src/link/local-state.test.ts`; `git.test.ts` (two worktrees)            |
| `state.json` records when each tab was last synced; the last `SYNC_REPORTS_KEPT` reports kept    | `local-state.test.ts`                                                             |
| One sync at a time: a second waits, then fails after `SYNC_LOCK_WAIT_MS` naming the pid          | `apps/cli/src/link/lock.test.ts` (fake clock); stale lock taken over              |
| `sync --watch`: room bursts settle, then one pass; one line per sync                             | `apps/cli/src/link/sync-watch.test.ts` (fake sockets and timers)                  |
| `sync --watch`: local changes synced after `SYNC_LOCAL_SETTLE_MS`; own writes ignored            | `sync-watch.test.ts`                                                              |
| `sync --watch` reconnects as the room stream does; trashed and refused tickets handled           | `sync-watch.test.ts`                                                              |
| `link status` prints every covered document with its state                                       | `link.test.ts`                                                                    |
| `link ls` prints as `document ls`                                                                | `link.test.ts`; `packages/agent-verbs/src/verbs/verbs.test.ts` (shared rows)      |
| Help within budgets, the new resource and verbs listed                                           | `apps/cli/src/help/help.test.ts`, `dispatch/commands-table.test.ts`               |
| Exit codes per action; highest wins                                                              | `sync.test.ts`                                                                    |
| Telemetry `Cli·Used·LinkInit`, `LinkStatus`, `LinkLs`, `Sync`, `SyncWatch`                       | `apps/cli/src/telemetry.test.ts`; `apps/telemetry` `metric-series.test.ts`        |
| Debug fingerprints carry ids only                                                                | `sync.test.ts` (debug output scanned for names and paths)                         |
| A self-host link never contacts livediagram.app                                                  | `sync.test.ts` (every request's origin)                                           |

Rules under Open questions get their tests when the answers land.

## Constants and configuration

| Constant                  | Value              | Provenance                                   | Safe range      |
| ------------------------- | ------------------ | -------------------------------------------- | --------------- |
| `LINK_FILE_NAME`          | `livediagram.toml` | Spec                                         | fixed           |
| `MIRROR_DEFAULT_LEVEL`    | `index`            | Spec                                         | fixed by spec   |
| `MIRROR_DEFAULT_DIR`      | `diagrams`         | Spec                                         | fixed by spec   |
| `INDEX_FILE_NAME`         | `INDEX.md`         | Spec                                         | fixed           |
| `LINK_ID_HEX`             | 16                 | As read-copy keys (CLI76), RL8               | 16 to 64        |
| `LINK_ID_MAX`             | 128                | RL3                                          | 64 to 256       |
| `SYNC_LOCK_WAIT_MS`       | 30000              | Spec                                         | 10000 to 120000 |
| `SYNC_LOCK_POLL_MS`       | 250                | RL18                                         | 100 to 1000     |
| `SYNC_LOCAL_SETTLE_MS`    | 1500               | Spec                                         | 500 to 5000     |
| `WAIT_SETTLE_MS` (reused) | 2000               | Spec ("the `wait --for change` rule"), CLI80 | as CLI80        |
| `SYNC_WATCH_COVERAGE_MS`  | 60000              | RL21                                         | 15000 to 600000 |
| `SYNC_CONCURRENCY`        | 2                  | As `EXPORT_CONCURRENCY` (CLI29)              | 1 to 4          |
| `SYNC_REPORTS_KEPT`       | 20                 | Spec                                         | 5 to 100        |
| `SYNC_BASES_KEPT`         | 5                  | Spec; used by the second slice               | 3 to 20         |
| `SYNC_MERGE_ATTEMPTS`     | 3                  | Spec; second slice                           | 1 to 5          |
| `SYNC_HOOK_BUDGET_MS`     | 5000               | Spec; second slice                           | 2000 to 15000   |

Environment: none new. `LIVEDIAGRAM_DEBUG`, `XDG_CACHE_HOME` and the profile variables as the CLI reads them.

## Assets and external resources

| Asset             | Source                        | Licence                | Path                                                                                     |
| ----------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `smol-toml` 1.9.0 | npm (latest, confirmed)       | BSD-3-Clause           | bundled into `dist/livediagram.mjs`; its notice in `THIRD_PARTY_LICENSES` by `build.mjs` |
| Golden fixtures   | written by the tests' authors | MIT (the repository's) | `apps/cli/src/link/__fixtures__/`                                                        |

## Not in this slice

Each is the second build (`plans/0047-repository-sync.md`) and is blueprinted when that plan's phase 1 runs.

- **Merging** (`@livediagram/tab-merge`, the merge table, fields, live fields, lost local values, the CAS loop,
  `SYNC_MERGE_ATTEMPTS`): `ahead` and `diverged` are refused in this slice.
- **Base snapshots** in `<state dir>/bases/` (`SYNC_BASES_KEPT`) and the `git log` fallback.
- **Pending proposals** in `<state dir>/pending/` and their send.
- **`local-new` creation** of a document in the link's folder (Open: Q7 for what this slice does with one).
- **Offline pushes** and the view-level one-way rule's "local changes reported as not sent".
- **`sync --resolve <file>`** and **`sync --hook`** (Open: Q8 for the hint this slice prints).
- **`link hooks install|uninstall`**, the pre-commit and pre-merge-commit hooks, partial-staging refusal,
  `[hooks] block`, `SYNC_HOOK_BUDGET_MS`, telemetry type `LinkHooks`.
- **The merge driver** and `.gitattributes`.
- **`link status --fail-behind`** and the no-token rule in CI.
- **Diagram sources**: `link adopt`, bridges, markers, `[[sources]]`
  ([Diagram sources](../diagram-sources.md)).
- **Fingerprints** `[sync] sent`, `merged`, `lost-local-value`, `pending`, `resolved`.

## Open questions

The spec is ambiguous or contradictory on these rules of this slice; each is answered in the spec first, then
folded in here.

- **Q1** `link init` with no `--folder`: the spec says it "offers the person's folders"; the CLI never prompts,
  on a terminal or not (CLI spec "Never interactive when piped", blueprint I2, CLI66), and plan 0046 says "folder
  picker when interactive, refusal when piped". Is the offer an interactive picker on a terminal (an exception to
  CLI66), or a refusal (exit 2) listing the folders with a runnable `link init --folder` line each, as
  `skill install` lists directories? And does `--doc` alone (no folder) still trigger the offer?
- **Q2** `INDEX.md`'s "in the folder's order": the Explorer lists folders by name and documents newest first, which
  reorders the file on every save and churns git; or a stable order (folder path, then document name, then id).
  Which?
- **Q3** A document renamed (or its deck changed) with no tab revision moving is `in-step` by the state table, so
  its mirror file keeps the old `document.name` while `INDEX.md` shows the new one. Does a sync rewrite the mirror
  file when the document's own fields differ (a fourth comparison besides tab revisions and hashes), or does the
  file keep them until a tab changes?
- **Q4** `link status` exit: the Commands table says "exit 0 when all are `in-step`" (so non-zero otherwise),
  while the Git section says in CI it "fails a build only when asked (`--fail-behind`)". Without `--fail-behind`,
  what does `link status` exit when a document is `behind`: 0 always, or non-zero (and which code)?
- **Q5** States at `index` and `none`, where there is no mirror file: the state table compares mirror files. At
  `index`, are states computed against the revisions `INDEX.md` records (parsing it back), against the local sync
  state's last-synced revisions, or not at all (only `new`/`in-step`/`gone`/`unreadable` by coverage)? At `none`,
  what does `link status` print?
- **Q10** A `gone` document whose mirror file holds a local change (edited, not pushed, perhaps not committed): the
  `gone` row "removes its files; git history keeps them", but an uncommitted change is in no history, and
  Principle 4 says a sync never overwrites a local change it has not sent. Is such a file removed anyway, kept and
  refused (naming the file), or kept and reported?
- **Q6** Lowering the level (`files` to `index` or `none`, `index` to `none`): does a sync remove the files the
  higher level wrote (as `gone` removes, git history keeping them), leave them and say so, or refuse until they are
  removed by hand? And does an `index`-level sync treat mirror files left in `dir` as `tracked`?
- **Q7** `local-new` in the first build: the spec's Status puts offline pushes in the second build and plan 0047
  phase 3 creates `local-new` documents there, while plan 0046 says the first build "reports" `local-new`. In this
  slice, is a `local-new` file reported only (with which next step, as no command creates a document from an
  envelope today), or created? Also: a link with `documents` and no `folder` has no "link's folder" to create in;
  where does a `local-new` document go then?
- **Q8** A file with conflict markers is refused "naming `livediagram sync --resolve <file>`", which is part of the
  git work in the second build. In this slice, is `sync --resolve` built too, or does the refusal name something
  else until it exists (for example resolving by hand and `livediagram push <file>`)?
- **Q9** `link init` "says so in one line when the repository has a public remote". The CLI can only learn a
  remote's visibility by asking its forge (a request to GitHub's api), which breaks "a profile contacts its own
  host and nothing else" (CLI blueprint I5). Is the line printed whenever any remote exists, only for a forge
  host the CLI recognises (asking its api), or dropped?

## Defaults ledger

RL1 to RL34 in [DEFAULTS.md](DEFAULTS.md).
