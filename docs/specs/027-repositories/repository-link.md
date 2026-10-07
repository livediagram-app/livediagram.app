# Repository link

**Status: specified.** The link, the `index` and `files` mirror levels, pulling and watching are the first build
(`plans/0046-workbench-live-diagram.md`); the merge, offline pushes and the git integration are
the second (`plans/0047-repository-sync.md`).

A **repository link** binds a directory in a code repository to documents in livediagram, so the people and agents
working in that repository find, read and change its diagrams without leaving it. livediagram is the **single source
of truth**: what a repository holds of a document is a **snapshot** of it at a known revision, never its home, as
the [Google Drive mirror](../022-drive-mirror/drive-mirror.md) is a copy and never a location.

## Why

- Agents look for context with `rg` and `ls`. A diagram that only lives behind a URL is invisible to them.
- People draw faster than they commit. A repository that tried to be the diagram's home would always be behind, and
  two homes always disagree.
- Not every project wants files. A product spread over several repositories, or a team keeping one diagrams
  repository, wants the link and the agent access without copies in every tree.

## Principles

1. **livediagram owns every document.** A snapshot in a repository is derived; a change made to it is a proposal that
   reaches livediagram as a [changeset](../024-agents/agent-changesets.md), or does not count.
2. **Files are optional.** A link works with no files at all; the CLI reaches the covered documents remotely.
3. **A snapshot says how old it is.** Every mirrored tab records its revision, so any reader knows what it holds.
4. **Nothing is lost, nothing is silent.** A sync never overwrites a local change it has not sent, and every
   automatic resolution is printed and recorded where people will see it.
5. **Deterministic files.** The same document at the same revisions writes the same bytes, so git shows only real
   change.

## The link file

`livediagram.toml`, committed at the root of the directory it links (the repository root, or a package in a
monorepo). It holds identifiers and settings, never a credential.

```toml
# This repository's diagrams live in livediagram; see https://livediagram.app/help/developers/repositories/
host = "https://livediagram.app"   # optional; a self-host names its own

[covers]
folder = "fld_8k2m4q"              # a personal or team folder, its subfolders included
documents = ["doc_3h9x2a"]         # and any single documents, from anywhere the person can open

[mirror]
level = "files"                    # none | index | files
dir = "docs/diagrams"              # relative to this file
```

- **Covers.** A link covers the documents in its `folder` (subfolders included) and its listed `documents`. Either
  may be absent, not both. A document moved out of the folder leaves the link's coverage; a listed document stays
  covered wherever it moves.
- **Host.** Absent means the CLI's active profile's host. A link naming another host than the active profile is
  refused with the profile to use; a self-host link never contacts livediagram.app.
- **Several links.** A command acts on the nearest `livediagram.toml` at or above the working directory; `--all`
  acts on every link below it. Two links covering one document each keep their own snapshot.
- **Unknown keys** are refused by name, so a typo never silently does nothing.

## Mirror levels

| Level   | Writes                                                                  | For                                                          |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `none`  | Nothing                                                                 | Remote-only projects; agents use the CLI against the link    |
| `index` | `<dir>/INDEX.md` only                                                   | Agents find diagrams with `rg` and read them through the CLI |
| `files` | `INDEX.md`, plus per document a mirror file and an outline file (below) | Diagrams readable offline, in reviews and in git history     |

`index` is the default: it makes every covered document discoverable at almost no cost in the tree.

### `INDEX.md`

Generated, and opening with a line that says so and where to edit. One section per document, in the folder's
order: its name, its link, its folder path, each tab's name, kind, element count and revision, and (at `files`) the
paths of its files. At `index` each tab also carries its outline's header line, so `rg` finds a document by its
tab names and counts; at `files` the outlines are in the outline files.

### The mirror file

`<folder path>/<slug>.livediagram.json`: the CLI's [pull file](../015-api/cli.md#local-files), so the editor's
"Import a copy" reads it, with these rules for a committed copy:

- **One element per line**, in the tab's stored order, keys sorted. A change to one element is a one-line diff, and
  `rg "Play button"` lands on the element's line.
- `livediagramSync` keeps the host and each tab's `rev`, `hash` and `settingsHash`. It holds **no time** (a pull at
  an unchanged revision writes the same bytes); when it was last synced lives in the local sync state.
- The slug comes from the document's name at first mirror and then stays: the path is stable while the document is
  renamed or moved, and a sync names the files whose path would now differ (`sync --relocate` moves them, through
  `git mv` inside a git work tree).
- Formatting is not meaning: a file reformatted by another tool parses alike, hashes alike (the hash is over
  canonical JSON), and is rewritten in the canonical form at its next change.

### The outline file

`<slug>.md` beside the mirror file: generated, opening with a line that says so and links the document, then one
section per tab holding its [outline view](../024-agents/document-views.md#the-outline-default) in a `text` fence.
It is what an agent reads first, at a tenth of the JSON's tokens, and what a reviewer reads in a pull request.

## Sync states

A covered document is in one state, from comparing its mirror file, the file's recorded revisions and hashes, and
the document now:

| State       | Means                                                                       | A sync                                       |
| ----------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| `in-step`   | Local hashes match the recorded ones; the revisions are the document's      | Nothing                                      |
| `behind`    | Local unchanged; livediagram has newer revisions                            | Writes the newer snapshot                    |
| `ahead`     | Local changed; livediagram unchanged since the recorded revisions           | Sends the local change ([Merging](#merging)) |
| `diverged`  | Both changed                                                                | Merges, then sends ([Merging](#merging))     |
| `new`       | Covered, never mirrored                                                     | Writes it                                    |
| `local-new` | A mirror file in `dir` naming no document livediagram has                   | Creates the document in the link's folder    |
| `gone`      | Trashed, moved out of coverage, or no longer readable by the person syncing | Removes its files; git history keeps them    |

A missing mirror file of a covered document is `new` again: deleting a file never deletes a document. A document
that cannot be read for a transient reason (offline, rate limited, a server failure) keeps its files untouched and
is reported, never treated as `gone`.

Until the merge is built, `ahead` and `diverged` are refused per document, naming the file and the command that
sends it (`livediagram push <file>`), and the rest of the sync proceeds.

## Merging

A merge is a **three-way merge per tab, element by element**, of the **base** (the snapshot the local change was made
from), the **local** file and the **remote** tab now. It lives in one pure package, `@livediagram/tab-merge`, so the
CLI and git's merge driver merge alike, and any other front door can.

**The base** is the tab at the recorded revision. The CLI keeps every snapshot it writes in its local sync state
(below), keyed by document, tab and revision; inside a git work tree it falls back to the file's own history
(`git log` for the version recording that revision). A merge with no base is a **baseless merge**: every element
that differs takes the remote version, local-only elements are added, and each difference is reported.

| Base → local | Base → remote   | Result                                                                   |
| ------------ | --------------- | ------------------------------------------------------------------------ |
| added        | absent          | Added                                                                    |
| changed      | unchanged       | Local                                                                    |
| unchanged    | changed         | Remote                                                                   |
| changed      | changed         | Field by field: each side's changed fields; a field both changed: remote |
| removed      | unchanged       | Removed                                                                  |
| removed      | changed         | Remote kept: an edit outranks a delete                                   |
| changed      | removed         | Local restored: an edit outranks a delete                                |
| reordered    | order unchanged | Local order for the elements it moved                                    |

- **Fields** are an element's top-level fields; an arrow's ends, points and label are one field each. The
  [live fields](../024-agents/agent-changesets.md#what-a-changeset-is) (comments, answers, votes, ticks) are never
  merged from a file: livediagram's always stand.
- **No silent path.** A field both sides changed is a **lost local value**: the merge keeps it in the sync report and
  as a comment on the element in livediagram, "Not applied from <path>: label was "Start game"", authored by the
  person syncing, so whoever looks at the diagram sees it and can resolve it. A restored element and a kept remote
  edit are reported likewise.
- **Tab settings** (name, theme, background) follow livediagram; a local change to them is reported as not sent.
  A tab added in the file is created; a tab removed from the file is not deleted.
- **The send** is one strict `replace` changeset per merged tab, based on the remote revision the merge read. When
  that revision moved meanwhile (`412 stale_tab`) the sync re-reads and re-merges, up to `SYNC_MERGE_ATTEMPTS`
  times, then reports the tab as still diverged. Held elements answer as for any changeset (`--wait-held`).

## Commands

| Command                                             | Does                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `link init [--folder <f>] [--doc <d>]... [--level]` | Writes `livediagram.toml`; with no folder, offers the person's folders |
| `link status`                                       | Every covered document with its state; exit 0 when all are `in-step`   |
| `link ls`                                           | The covered documents, as `document ls` prints them                    |
| `sync [--watch] [--relocate] [--dry-run] [--all]`   | One sync of the link; `--watch` keeps syncing until interrupted        |
| `link hooks install\|uninstall`                     | The git hooks and the merge driver (below)                             |

- Every other command takes a mirror file's path wherever it takes a document, as it takes a pulled file today.
- `sync --watch` listens to each covered document's room through the CLI's [room stream](../015-api/cli.md) and
  writes a tab's snapshot after its burst of changes settles (the `wait --for change` rule), and watches the mirror
  directory for local changes, syncing them after `SYNC_LOCAL_SETTLE_MS` of quiet. It reconnects as the room stream
  does and prints one line per sync.
- One sync runs at a time per link: a lock in the local sync state makes a second wait for it, or fail after
  `SYNC_LOCK_WAIT_MS` naming the holder's process id.

## Git

Git moves slower than diagrams, so the repository holds **snapshots at commit time**, kept honest three ways:

- **The pre-commit hook** runs `livediagram sync --hook`: one sync, then `git add` of exactly the files it wrote. A
  commit therefore carries the diagrams as they were when it was made, and the local changes it carries have reached
  livediagram. Within `SYNC_HOOK_BUDGET_MS`, offline, or signed out, the hook lets the commit through with one stderr
  line naming the revisions the snapshot holds; `[hooks] strict = true` in the link file fails the commit instead.
- **The merge driver** (`.gitattributes`: `*.livediagram.json merge=livediagram`) resolves two branches' snapshots
  with `@livediagram/tab-merge`, base `%O`, ours `%A`, theirs `%B`, and then, online, takes livediagram's current
  revision for every tab neither branch changed locally. Diagrams are not branched: both branches converge on the one
  document.
- **`link status`** in CI answers whether the committed snapshots are current; it never fails a build unless asked
  (`--fail-behind`), and without a token it says so and exits 0.

`link hooks install` writes the hooks through the repository's `core.hooksPath` when one is set (Husky, lefthook),
appending one line and never replacing a hook; it registers the driver in `.git/config` and the attribute in
`.gitattributes`.

## Local sync state

Per link, never committed: inside a git work tree at `<git dir>/livediagram/<link id>/` (each worktree its own),
elsewhere at `~/.cache/livediagram/links/<link id>/`. The link id is a hash of the link file's absolute path. It
holds the base snapshots (the latest `SYNC_BASES_KEPT` per tab), when each tab was last synced, and the lock.

## Who may sync

- The person syncing reads and writes with their own credential, so each person's sync reaches only what they can
  open; a teammate without access to a document leaves its snapshot untouched and is told so once per sync.
- A view-level token syncs one way: snapshots are written, local changes are reported as not sent.
- The mirror is as public as the repository: `link init` says so in one line when the repository has a public
  remote. Document and folder ids in `livediagram.toml` grant nothing.

## Limits

| Constant               | Value | Why                                                                      |
| ---------------------- | ----- | ------------------------------------------------------------------------ |
| `SYNC_MERGE_ATTEMPTS`  | 3     | A busy tab settles within a few attempts; more means people are mid-edit |
| `SYNC_LOCAL_SETTLE_MS` | 1500  | An editor's save and a formatter's rewrite land as one change            |
| `SYNC_LOCK_WAIT_MS`    | 30000 | Longer than a sync of a large folder; shorter than a person's patience   |
| `SYNC_HOOK_BUDGET_MS`  | 5000  | A commit never waits on a slow network for longer                        |
| `SYNC_BASES_KEPT`      | 5     | Covers several syncs while a local edit is in flight                     |

## Observability and telemetry

- CLI debug fingerprints: `[sync] state`, `[sync] wrote`, `[sync] sent`, `[sync] merged`, `[sync] lost-local-value`,
  `[sync] gone`, `[sync] refused`, `[sync] lock-wait`, each with the document and tab ids, never content.
- Telemetry: category `Cli`, action `Used`, type the verb (`LinkInit`, `Sync`, `SyncWatch`, `LinkHooks`), as every
  command ([CLI](../015-api/cli.md#telemetry)).
