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
level = "files"                    # none | index | files; default index
dir = "docs/diagrams"              # relative to this file; default diagrams

[hooks]
block = false                      # true: a commit fails when its sync cannot run

[[sources]]                        # sources without a comment syntax (Diagram sources)
path = "docs/arch.excalidraw"
tab = "doc_3h9x2a/0b34"
```

These are every table and key a link file holds; [Diagram sources](diagram-sources.md) owns `[[sources]]`.

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

Generated, and opening with a line that says so and where to edit. One section per document, in a stable
order (folder path, then name, then id, so a new document never reorders the rest): its name, its link, its folder path, each tab's name, kind, element count and revision, and (at `files`) the
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

| State        | Means                                                                                    | A sync                                       |
| ------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| `in-step`    | Local hashes match the recorded ones; the revisions are the document's                   | Nothing                                      |
| `behind`     | Local unchanged; livediagram has newer revisions                                         | Writes the newer snapshot                    |
| `ahead`      | Local changed; livediagram unchanged since the recorded revisions                        | Sends the local change ([Merging](#merging)) |
| `diverged`   | Both changed                                                                             | Merges, then sends ([Merging](#merging))     |
| `new`        | Covered, never mirrored                                                                  | Writes it                                    |
| `local-new`  | A file in `dir` holding a document envelope with no `livediagramSync`: written by hand   | Creates the document in the link's folder    |
| `gone`       | The api answers `410 document_trashed`, or the document is readable and outside coverage | Removes its files; git history keeps them    |
| `unreadable` | The api answers `404` for the file's document: purged, or not this person's to open      | Nothing; reported once per sync              |

- **Only an envelope without sync data is new.** A file whose `livediagramSync` names a document is never created
  again, whatever the api answers, so a teammate without access, a purged document's file on an old branch or a
  file a merge brings back never makes a duplicate. The api answers a document someone may not open exactly as an
  absent one, so `unreadable` covers both and touches nothing.
- A missing mirror file of a covered document is `new` again: deleting a file never deletes a document. A file of
  an `unreadable` document stays until someone deletes it.
- A document that cannot be read for a transient reason (offline, rate limited, a server failure) keeps its files
  untouched and is reported, never treated as `gone` or `unreadable`.
- A file holding git's conflict markers is refused, naming `livediagram sync --resolve <file>`
  ([Git](#git)); nothing else in the sync waits for it.
- **A broken file holds its document back.** A conflicted or otherwise invalid file at a document's mirror path
  holds that document's write back: the document is reported, naming the file and its fix, and never written again
  at another path.
- **A rename is a change.** A document whose name or other envelope fields differ from its file is `behind` even
  when no tab's revision moved, and its files are rewritten.
- **Without mirror files** (`none`, `index`) a document's state comes from the revisions the local sync state
  recorded at its last sync; a document never synced on this machine is `new`.
- **A gone file with an unsent change stays.** A `gone` or level-lowered file whose hashes differ from its recorded
  ones holds a local change nobody has sent; it is kept and refused, naming the file, never removed.

Until the merge is built, `ahead` and `diverged` are refused per document, naming the file and the command that
sends it (`livediagram push <file>`), and the rest of the sync proceeds. Until then too, `local-new` is reported
and never created, and a conflicted file's refusal names the manual fix (keep one side with
`git checkout --ours <file>` or `--theirs`, then sync) in place of `sync --resolve`.

**Lowering the mirror level** (`files` to `index`, or to `none`) removes the files the new level does not write, as
`gone` removes them; git history keeps them.

## Merging

A merge is a **three-way merge per tab, element by element**, of the **base** (the snapshot the local change was made
from), the **local** file and the **remote** tab now. It lives in one pure package, `@livediagram/tab-merge`, so the
CLI and git's merge driver merge alike, and any other front door can.

**The base** is the tab at the recorded revision. The CLI keeps every snapshot it writes in its local sync state
(below), keyed by document, tab and revision; inside a git work tree it falls back to the file's own history
(`git log` for the version recording that revision). A merge with no base (a cleared cache, a squashed history, a
fresh clone) is a **baseless merge**: every field that differs takes the remote value and records the local one as
a lost local value (below); elements only in the file are added, as an edit outranks a delete, and listed in the
report and the changeset's summary.

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

| Command                                             | Does                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `link init [--folder <f>] [--doc <d>]... [--level]` | Writes `livediagram.toml`; with no folder, a picker of the person's folders          |
| `link status`                                       | Every covered document with its state; exits 0 ([In CI](#in-ci) for `--fail-behind`) |
| `link ls`                                           | The covered documents, as `document ls` prints them                                  |
| `sync [--watch] [--relocate] [--dry-run] [--all]`   | One sync of the link; `--watch` keeps syncing until interrupted                      |
| `sync --resolve <file>`                             | A mirror file git left conflicted, resolved by the driver's table                    |
| `link hooks install\|uninstall`                     | The git hooks and the merge driver ([Git](#git))                                     |

- `link init` without `--folder` or `--doc` shows a picker of the person's folders on a terminal; where stdin or
  stdout is not a terminal it refuses, listing the folders as runnable `link init --folder <id>` commands.
- Every other command takes a mirror file's path wherever it takes a document, as it takes a pulled file today.
- `sync --watch` listens to each covered document's room through the CLI's [room stream](../015-api/cli.md) and
  writes a tab's snapshot after its burst of changes settles (the `wait --for change` rule), and watches the mirror
  directory for local changes, syncing them after `SYNC_LOCAL_SETTLE_MS` of quiet. It reconnects as the room stream
  does and prints one line per sync.
- One sync runs at a time per link: a lock in the local sync state makes a second wait for it, or fail after
  `SYNC_LOCK_WAIT_MS` naming the holder's process id.

## Git

Git moves slower than diagrams, so the repository holds **snapshots at commit time**. Diagrams are not branched:
every branch's snapshots are views of the one document, and every branch's local changes are proposals to it.

### The hooks

- **Pre-commit** (and **pre-merge-commit**, which `git merge` runs instead) runs `livediagram sync --hook`: one sync,
  then `git add` of exactly the files it wrote. A commit carries the diagrams as they were when it was made, and the
  local changes it carries have reached livediagram.
- **Partial staging is refused.** A mirror file whose staged content differs from the work tree, or a commit with
  its own index (`git commit -o`, `GIT_INDEX_FILE`), would commit what the person did not stage; the hook fails
  naming the file and the fix (`git add <file>`), and syncs nothing.
- **Never in the way.** Past `SYNC_HOOK_BUDGET_MS`, offline, or signed out, the commit goes through with one
  stderr line naming the revisions its snapshots hold. `[hooks] block = true` fails the commit instead.
- **The hook line** is guarded, so a teammate without the CLI commits as before:
  `if command -v livediagram >/dev/null 2>&1; then livediagram sync --hook; fi`. `link hooks install` appends it,
  never replacing a hook, to the tracked hook file where a hook manager keeps one (Husky's `.husky/pre-commit`,
  never its generated `.husky/_`; a `pre-commit` command in `lefthook.yml`), committed for everyone, and otherwise
  to `.git/hooks`, for this clone only.

### The merge driver

`.gitattributes` (committed): `*.livediagram.json merge=livediagram`; the driver itself is registered per clone in
`.git/config` by `link hooks install`. It merges two branches' copies of a mirror file **tab by tab**, telling
livediagram's history from local changes by each copy's own record: a tab whose hash equals its recorded hash is a
**clean snapshot**, any other tab carries a **local change**.

| Ours           | Theirs         | Result                                                                              |
| -------------- | -------------- | ----------------------------------------------------------------------------------- |
| clean snapshot | clean snapshot | The higher revision's tab, verbatim                                                 |
| local change   | clean snapshot | Ours, with its own recorded revision; the next sync merges it with livediagram      |
| clean snapshot | local change   | Theirs, likewise                                                                    |
| local change   | local change   | Ours; theirs is kept as a **pending proposal** in the local sync state and reported |

- The driver never merges two snapshots element by element: two revisions of livediagram are not two edits, and
  their difference is never sent back.
- It works offline and sends nothing. The next sync sends pending proposals first, each merged against livediagram
  from its own base, so both branches' changes arrive.
- A tab in only one copy is kept; the document envelope's other fields come from the copy with the higher revision.
- **Without the driver** (a clone that never ran `link hooks install`), git merges the text and may leave conflict
  markers. `livediagram sync --resolve <file>` reads the three versions from git's index (`:1:`, `:2:`, `:3:`),
  applies the driver's table and stages the result.

### In CI

`link status` answers whether the committed snapshots are current; it fails a build only when asked
(`--fail-behind`), and without a token it says so and exits 0.

## Local sync state

Per link, never committed: inside a git work tree at `<git dir>/livediagram/<link id>/` (each worktree its own),
elsewhere at `~/.cache/livediagram/links/<link id>/`. The link id is a hash of the link file's absolute path. It
holds the base snapshots (the latest `SYNC_BASES_KEPT` per tab), the pending proposals, the last
`SYNC_REPORTS_KEPT` sync reports, when each tab was last synced, and the lock.

## Who may sync

- The person syncing reads and writes with their own credential, so each person's sync reaches only what they can
  open; a teammate without access to a document finds it `unreadable`: its snapshot stays untouched and they are
  told so once per sync.
- A view-level token syncs one way: snapshots are written, local changes are reported as not sent.
- The mirror is as public as the repository: `link init` says so in one line when the repository has any git
  remote. Document and folder ids in `livediagram.toml` grant nothing.

## Limits

| Constant               | Value | Why                                                                      |
| ---------------------- | ----- | ------------------------------------------------------------------------ |
| `SYNC_MERGE_ATTEMPTS`  | 3     | A busy tab settles within a few attempts; more means people are mid-edit |
| `SYNC_LOCAL_SETTLE_MS` | 1500  | An editor's save and a formatter's rewrite land as one change            |
| `SYNC_LOCK_WAIT_MS`    | 30000 | Longer than a sync of a large folder; shorter than a person's patience   |
| `SYNC_HOOK_BUDGET_MS`  | 5000  | A commit never waits on a slow network for longer                        |
| `SYNC_REPORTS_KEPT`    | 20    | Enough to find what last week's syncs did; small enough to never matter  |
| `SYNC_BASES_KEPT`      | 5     | Covers several syncs while a local edit is in flight                     |

## Observability and telemetry

- CLI debug fingerprints: `[sync] state`, `[sync] wrote`, `[sync] sent`, `[sync] merged`, `[sync] lost-local-value`,
  `[sync] gone`, `[sync] unreadable`, `[sync] pending`, `[sync] resolved`, `[sync] refused`, `[sync] lock-wait`, each with the document and tab ids, never content.
- Telemetry: category `Cli`, action `Used`, type the verb (`LinkInit`, `Sync`, `SyncWatch`, `LinkHooks`), as every
  command ([CLI](../015-api/cli.md#telemetry)).
