# Version history

Every tab of a server-stored document keeps **versions**: copies of its content as it stood at earlier moments,
kept by the document itself. Anyone who can open the tab can look back through them; an Editor can bring one back
(**Restore**) or put it beside the current tab as a new one (**Make a Copy**). It is livedocuments' alone: the other
apps keep no versions (Work Tracker 841 asked for every app and was turned down; 929 asked again for livedocuments
only).

## Why

Undo lasts only as long as the browser tab, and History (the Explorer's, [History](../013-workspace/history.md)) says
who did what but cannot open or bring back anything. A bad bulk edit, an assistant's rewrite that went wrong or a
collaborator's mistake on a long article or deck was permanent. Google Docs (Version History), Notion (Page
History) and Word (Version History) all keep versions, and writers moving from them expect it.

## Domain language

| Term                  | Means                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **version**           | One tab's stored content (its body: elements, pages, articles and look) at one tab revision.   |
| **named version**     | A version someone gave a name. It is kept until it is unnamed or its tab is deleted.           |
| **automatic version** | A version with no name, made by the document itself. Kept within the bounds below.             |
| **restore**           | Making a version the tab's current content again, as one change by the person who restores it. |
| **make a copy**       | A new tab after the document's last, holding a version's content.                              |

"Snapshot" names the platform's previews ([Document previews](document-snapshots.md)), never a version. A version is
of a **tab**, as every write is ([Agent changesets](../024-agents/agent-changesets.md): one tab, one changeset); the
document's name, its tab order and folders, its slide deck and its share links are not in it.

## When a version is kept

The document keeps a version, at most one per tab revision, at four moments:

| Kind      | When                                                                                                                                                                                                                                                                                                                                                                                    | Who it names                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `idle`    | **After about 30 minutes idle.** The first write to a tab that had not changed for `VERSION_IDLE_MS` (30 minutes) keeps the tab as it stood, before the write lands. A working session therefore ends in a version, timed when its last edit landed. Every write path meets it: an editor's save, a delta save, a Participant's writing, a changeset, a revert, a restore, a migration. | Nobody                       |
| `agent`   | **Before an agent's changeset.** Before the first changeset of an agent's burst on a tab: one from an API token with no changeset from the same token on that tab in the last `VERSION_AGENT_BURST_MS` (10 minutes). An assistant's run of edits is one version before it, never one per edit. An agent's page change or article write counts as its changeset.                         | The person whose token wrote |
| `restore` | **Before a restore.** The content a restore replaces, so the restore can be undone.                                                                                                                                                                                                                                                                                                     | The person who restored      |
| `manual`  | **Name This Version.** The tab's current content, named. Naming an older version names that one instead (no copy).                                                                                                                                                                                                                                                                      | The person who named it      |

- **One per revision.** A moment that would keep a revision already kept keeps nothing new (an `idle` version and
  an `agent` one at the same revision are one version). Naming the current content when it is already kept names
  that version.
- **The idle check costs nothing on a busy tab.** It is a trigger on the tab row comparing two numbers, so an
  autosave every 600 ms while someone types pays only the comparison; the copy is SQLite copying the stored body,
  never parsed in JavaScript.

## Bounds

The api has no bucket, so versions live in the document's Durable Object SQLite beside the tab and grow its
storage. They are bounded by count, age and bytes, per tab:

| Constant                 | Value      | Why                                                                                         |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| `VERSION_IDLE_MS`        | 30 minutes | A pause long enough to mean a session ended (Google Docs groups edits the same way)         |
| `VERSION_AGENT_BURST_MS` | 10 minutes | One assistant run, as the changeset toast coalesces a token's burst                         |
| `VERSION_AUTO_MAX`       | 50         | About a working fortnight of sessions on a busy tab                                         |
| `VERSION_AUTO_MAX_DAYS`  | 30         | Matches changeset retention and the Trash: work can be brought back as long as a delete can |
| `VERSION_AUTO_MAX_BYTES` | 16 MiB     | Eight of the largest tab (2 MB cap) or hundreds of a typical one                            |
| `VERSION_NAMED_MAX`      | 25         | Naming is deliberate; past 25 the oldest names are worth reviewing                          |

- **Automatic versions** are pruned in the same transaction as each new version: past the newest 50, kept more than 30
  days ago, and past 16 MiB counting from the newest. Age counts from when a version was kept, not from when its
  content was written: a tab untouched for two months and then edited keeps that two-month-old content as a fresh
  version. The document's daily
  upkeep drops those past 30 days on a tab nobody edits.
- **Named versions** are never pruned. Naming a 26th is refused (`409 too_many_names`, "This tab has 25 named
  versions. Remove a name from one first."); removing a name makes it an automatic version again, which the bounds
  then reach.
- **A deleted tab takes its versions with it** (the foreign key), and a deleted document all of them. A document's
  copy starts with none: its history is its source's.
- **What it costs.** Measured on node:sqlite with the stored bodies (`versions/version-storage.test.ts`): a typical tab
  (the slide-deck template's elements over 12 slides, 10 a slide) is 27 KB, so a tab at the 50-version cap holds
  about 1.3 MB of versions; a large tab (a 600-paragraph, 30-page article with 60 elements) is 154 KB, so 50 versions
  hold about 7.5 MB, under the byte cap. A tab at the 2 MB cap keeps 8 automatic versions. The worst case is the byte
  cap plus 25 named versions of the largest tab: about 64 MB per tab, inside a Durable Object's 10 GB. Keeping a
  version of a 2 MB tab adds about 3 ms to the write that keeps it (3.7 ms against 1.1 ms for the same write without
  a pause), and nothing to a save that is not the first after a pause.

## Opening a version

A version opens **read-only**. Nobody edits a version; they restore it, copy it, or name it.

- **What changed** is worked out against the tab as it is now, by element id: the elements the version has that the
  tab no longer has (**Removed since**), those both have that differ (**Changed since**), and those the tab gained
  (**Added since**); the pages the version has and the tab lacks, or the other way about; and whether an article's
  writing differs. The live fields (`commentThread`, `action`: the conversation, not the content) do not count.
- On the version's pages, each element **Removed since** is outlined in red and each **Changed since** in amber, with
  a legend; **Added since** has nothing to outline on the old pages and is counted in the summary line.
  **Show Changes** turns the outlines off and on.

## Restore

- **Through the room, as one change.** A restore writes the version's content as one
  [changeset](../024-agents/agent-changesets.md) by the person restoring (an agent's token for `restore_version`):
  recorded, merged into any save that had not seen it, relayed to the room so everyone with the tab open sees it at
  once, and revertable as one unit like any other changeset. Its summary is `Restored a version` (`Restored
“<name>”` for a named one). What the elements do not carry (the pages, the article writing, the theme and
  background) rides the same write and reaches the room as the `tab-meta` and `article` ops an agent's page change
  sends.
- **What stays.** The tab's name, lock, folder and connection are the tab's, not its content, and stay as they are.
  So does the conversation: an element both have keeps its current comment thread and assigned action, so a restore
  never deletes a comment on something it keeps.
- **Before it lands**, the content it replaces is kept as a `restore` version, so the restore can be undone even
  after the toast has gone. A restore of a version whose content is the tab's own changes nothing and says so.
- **Undo.** The restorer's own screen says "Restored the version kept <when>" with **Undo**, which restores that
  `restore` version: the whole tab put back exactly, pages and writing included, as another change everyone sees.
  Everyone else gets the changeset toast ("Webber changed 12 elements: Restored a version · Show · Undo"), whose
  Undo is the per-changeset revert: elements changed since are kept, as for any changeset. Personal Ctrl+Z never
  takes back a restore, as it never takes back a changeset.
- **Racing editors.** A restore is a write at the tab's revision with compare-and-swap; a write that lands in
  between makes it read the tab again and retry (twice, then `409 tab_busy`). An editor that saves after a restore
  it had not seen keeps the restore through the merge on save, element by element, as for any changeset: a person
  who changed an element after the restore keeps their change.
- **Held elements.** An agent's restore is held by people's selections like any agent changeset (`409
elements_held`); a person's is never held.

## Make a Copy

**Make a Copy** adds a new tab after the document's last, holding the version's content, named "<tab name> (copy)"
(or the name the editor sends, "<tab name> (14 Nov)"), shortened to the name cap. It is a changeset that creates a
tab, so everyone sees the tab arrive. The copy carries the content, not the conversation: comment threads and assigned
actions stay on the tab they were left on. The current tab is untouched. A link confined to one tab cannot make a tab, so
it has no Make a Copy.

## Who may do what

| Role                      | Look (list and open) | Name This Version | Restore | Make a Copy |
| ------------------------- | -------------------- | ----------------- | ------- | ----------- |
| **Viewer**                | Yes                  | No                | No      | No          |
| **Participant**           | Yes                  | No                | No      | No          |
| **Editor**                | Yes                  | Yes               | Yes     | Yes         |
| Editor through a tab link | Its own tab only     | Yes               | Yes     | No          |
| Community visitor         | No                   | No                | No      | No          |

- **Looking is every level's**, as reading the tab is: a version holds nothing the tab's readers could not have read
  when it was current. A link confined to one tab sees that tab's versions alone; a Community visitor (a content-only
  pass, [Community](../025-community/community.md)) sees none, since a version could carry the conversation the
  Community view leaves out.
- **Naming, restoring and copying are an Editor's**: each writes the document. The api checks the edit gate on every
  call; the editor gates the buttons on the session's `can.edit`, so an Editor previewing as a Viewer sees none.
- **An API token** reads with a read-only token and restores only with a writing one, as for any write.

## In the editor

- **History** is a header action, first among the right edge's (the shared `EditorHeader`'s `leadAction`), for every
  role, on a document stored on the server (not in This Browser, not in an embed or workbench frame), once the
  document is up. Its glyph is a clock with an arrow turning back. It opens **Version History** on the open tab.
- **Version History** covers the editor, header included, until closed (Close, or Escape): the version's pages on
  the left, drawn as the export draws them, and the rail of versions on the right (a sheet under the pages on a
  phone). Its own bar holds Close, the title "Version History" and, when the document has more than one tab the
  session may open, a tab picker naming the tab.
- **The rail.** **Now** first (the tab as it is), then the versions newest first under day headings (Today,
  Yesterday, the weekday within the week, then the date). Each row: its time, its name or its kind in words
  ("Automatic", "Before an AI edit", "Before restoring"), and who it names. The selected row is marked current.
  Named versions carry their name in the row's own weight; **Only Named Versions** filters to them.
- **Name This Version** (Editor) sits at the rail's head and names the current content; a row's **Name** (and
  **Rename**, **Remove Name**) edits a version's name in place, in the row.
- **The selected version** shows under the bar: its time, kind and author, the summary line ("Compared with now: 3
  changed, 2 removed, 1 added · 1 page added · the writing changed"), **Show Changes**, and for an Editor **Restore
  This Version** and **Make a Copy**. Restore asks first, in place ("Restore this version? The tab changes for
  everyone; you can undo it."), never in a separate dialog.
- **States.** Loading: a rail-shaped skeleton (`aria-busy`). No versions yet: the shared empty state, "No earlier
  versions yet. A version is kept after 30 minutes without changes, before an AI edit, and whenever you name one."
  A failed read says so with **Try Again**. A Viewer or Participant reads "Only an Editor can restore a version."
  where the buttons would be.
- **Fit.** A desktop shows the pages and the rail side by side; a phone shows the pages with the rail as a sheet
  below. Light and dark. Hover transitions are `duration-micro`. The panel's code loads when it is first opened.
- **Speed.** A version's body is read when its row is selected, one at a time, and kept for the panel's life (a
  small cache of the last 8); the change summary is worked out once per version (memoised), in one pass over each
  tab's elements by id.

## API

| Method | Path                                                         | Gate                         | Answer                                                                                                                     |
| ------ | ------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/documents/:id/tabs/:tabId/versions`                    | grant (view), not Community  | `{ versions: VersionSummary[] }`, newest first, no bodies                                                                  |
| GET    | `/api/documents/:id/tabs/:tabId/versions/:versionId`         | grant (view), not Community  | `{ version: VersionSummary, tab: Tab }`: the body as it was, with the tab's id and name                                    |
| POST   | `/api/documents/:id/tabs/:tabId/versions`                    | grant (edit)                 | Name This Version: `{ name }` → `201 { version }`                                                                          |
| PUT    | `/api/documents/:id/tabs/:tabId/versions/:versionId/name`    | grant (edit)                 | `{ name }` names or renames it; `{ name: null }` or `""` removes the name → `{ version }`                                  |
| POST   | `/api/documents/:id/tabs/:tabId/versions/:versionId/restore` | grant (edit)                 | `{ restored: { tabId, rev, changesetId, undoVersionId } }`, or `{ restored: null }` when the content was already the tab's |
| POST   | `/api/documents/:id/tabs/:tabId/versions/:versionId/copy`    | grant (edit), not a tab link | `{ name? }` → `201 { tab: { id, name, rev } }`                                                                             |

`VersionSummary` is `{ id, tabId, rev, kind, name, author: { name, color } | null, savedAt, createdAt, bytes,
elementCount }`. Refusals: `404 not_found` (no such tab or version, or a tab outside a tab link), `403` (below the
gate), `400 invalid_name` (a name of nothing), `409 too_many_names`, `409 tab_busy`, `409 elements_held` (an agent),
`413 tab_too_large` (a copy past the cap).

## MCP

`list_versions` (read) lists a tab's versions as the rail does, newest first, with their ids; `restore_version`
(destructive) restores one by id and says what changed and how to undo it (restore the `undoVersionId` it names)
([MCP server](../015-api/mcp-server.md) §4.9e).

## Observability and telemetry

- Logs: `[versions] kept` (kind, tab, revision, bytes), `[versions] pruned` (how many), `[versions] restored` and
  `[versions] copied` (tab, version, changeset), `[versions] refused` (the reason), never content.
- Telemetry: `Version·Opened·Header` (the panel opened), `Version·Named` (`Editor`), `Version·Restored` and
  `Version·Copied` typed by the front door (`Editor`, `Mcp`, `Cli`, `Api`), `Version·Undone·Editor` (the toast's
  Undo) ([Telemetry](../017-telemetry/telemetry.md)).

## Help

The help article **Version History** (`apps/help/app/tabs/version-history/page.mdx`, in the Tabs category) explains
when versions are kept, looking, restoring with Undo, Make a Copy, who may do what, and the two MCP tools.
