# Agent changesets

**Status: built.** Closed livediagram-app/livediagram.app#343. Operations are the full
[edit operations](edit-operations.md), in the line form or JSON, plus `replace`. Every answer carries the [lint](diagram-lint.md) of the tab it leaves; the
[agent presence](agent-presence.md) refresh is not built yet.

Every agent write to a tab is a **changeset**: one atomic write, applied by the api, sequenced by the document's
room, shown live to everyone with the tab open, credited to the person whose token wrote it, and revertable as one
unit. The whole-tab `PUT` stays the editor's own autosave path and nothing else's (see
[Whole-tab saves and tab renames](#whole-tab-saves-and-tab-renames)).

## Why

Before changesets an agent wrote a tab with the editor's whole-tab `PUT` ([API app](../015-api/api.md), "The
persistence boundary"). That write never reached the room, so:

- **A person never saw the agent's edit** until they reloaded, and their next autosave of the tab, built from a copy
  without it, erased it from D1.
- **An agent erased a person's edits.** The MCP's `update_document` read the tab, waited while the model thought,
  then wrote the whole tab back over anything saved in between.
- **A personal document had no room**, on the premise that it has one writer. An agent is a second writer.

## What a changeset is

| Field        | Meaning                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `id`         | `cs_` and 10 base32 characters, minted by the api                                                               |
| `documentId` | The document                                                                                                    |
| `tabId`      | The one tab it writes; a changeset never spans tabs                                                             |
| `agent`      | The token id and the owner id; absent when a signed-in session writes                                           |
| `summary`    | Optional, up to 80 characters, written by the agent ("add payment service"); shown in the toast and the history |
| `body`       | Either ordered [edit operations](edit-operations.md), or one `replace` (graph, Mermaid, template or elements)   |
| `base`       | Optional: the tab revision the agent read, and a fingerprint of every element the operations target             |
| `results`    | The result lines it printed, kept for `GET /api/documents/:id/changesets/:changesetId` and `changeset show`     |
| `rev`        | The tab revision the changeset produced                                                                         |
| `elementOps` | The `ElementOp`s it compiled to (`add`, `update`, `remove`, `reorder`), the unit the room and editors apply     |
| `inverse`    | The element ops that undo it, computed from the before-images                                                   |

- **Atomic.** Every operation lands or none does. A rejected changeset writes nothing and says why.
- **One tab, one changeset.** A new tab is a changeset that creates it (`replace` on a tab id the document lacks).
  A `replace`'s name names the tab it creates; on an existing tab it is ignored.
- **A new document** is not a changeset: nothing else can hold it yet. `POST /api/documents` creates it, compiling
  graph, Mermaid or template tabs with the same engine.
- **A fingerprint** covers the element without its live multi-writer fields (`LIVE_ELEMENT_FIELDS`: comments,
  answers, ideas, ticks and the like), which people change through deltas that never conflict with an agent's
  edit.

## The tab revision

Every tab carries `rev`, an integer that every write to it increments: an editor save, a changeset, a revert.
Every tab read returns it (the `rev` field and an `ETag`). It is how an agent says what it read and how an editor
says what it has seen.

## The write path

1. **Submit.** `POST /api/documents/:id/tabs/:tabId/changesets` with the body and optional base. Any identity with
   edit access to the tab may submit; only a token makes it an agent changeset. `?dryRun=1` runs steps 2 to 4 and
   returns the plan without writing.
2. **Check the base** (see [Conflicts](#conflicts)).
3. **Check held elements** (see [Held elements](#held-elements)).
4. **Compile.** The shared engine resolves selectors, applies the operations to the stored tab, normalises and lays
   out what they touched ([Edit operations](edit-operations.md)), and validates the result with `isValidTab`.
5. **Write** the tab with compare-and-swap on `rev`. A lost race repeats steps 2 to 5 once, then answers `409`.
6. **Record** the changeset in `agent_changesets` (D1) with its element ops and inverse.
7. **Relay** it to the submitting document's room as one sequenced `changeset` op. A relay failure is logged and
   never fails the write: D1 already holds it, and step 8 keeps it there. A tab linked into other documents is not
   relayed to their rooms; step 8 keeps it there too.
8. **Merge on save.** An editor's tab `PUT` carries `X-Changeset-Seen: <rev>`, the highest changeset revision it has
   applied. The api re-applies every recorded changeset after that revision to the incoming tab before writing,
   element by element:
   - an element the changeset **added** and the save lacks is added back;
   - an element the changeset **changed or removed** takes the changeset's version only when the save still holds
     the element exactly as the changeset found it (its before-image fingerprint). A save holding anything else
     changed it after, so the person's version stands. Taking the changeset's version keeps the save's live fields;
   - a **reorder** is re-applied only when the save still holds those elements in the order the changeset found.
     A save without the header (a bundle older than this spec) is treated as having seen nothing newer than
     `CHANGESET_MERGE_WINDOW` ago.

Because the merge reads D1 rather than the room, a changeset survives a dropped relay, a sleeping room and an
editor that was offline when it landed.

## What the room does

- Sequences the `changeset` op in one log slot, whatever its size, carrying `id`, `rev`, the owner's
  name and colour, the summary and the element ops.
- When the element ops exceed `CHANGESET_RELAY_MAX_BYTES`, the op carries no element ops and editors re-fetch the
  tab in place, as a resync does ([Resync without reloading the page](../012-collaboration/resync-without-reload.md)).
- Answers the api's internal `GET /selections?tab=<tabId>`: every element each connected person has selected (the
  whole multi-selection), whatever their role, and which of those sessions are the agent owner's own (recognised by
  the [person tag](agent-presence.md)).

## Rooms for personal documents

An editor connects to its document's room for every server-stored document it has open, personal ones included.
A document in Offline Mode or This browser has no room and no agent can reach it. On a personal document that is
neither shared nor in a team the editor sends only its selection and its tab focus; cursors, laser, viewport and
drag previews stay for documents with an audience.

## Whole-tab saves and tab renames

- A tab `PUT` presented with an API token is refused `405 use_changesets`, its message naming the changeset route.
  The CLI and the MCP server never do whole-tab saves.
- A tab is renamed with `PUT /api/documents/:id/tabs/:tabId/name { name }`, which advances the tab's `rev` and is
  relayed to the room as the `tab-meta` an editor's own rename sends. (A `document-meta` keeps every open editor's
  tab names, so a peer's stale tab list can never revert a rename.) The CLI's and the MCP's tab renames use it.

## Conflicts

The api compares the changeset's base with the stored tab:

| Situation                                                                          | Result                                                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No base                                                                            | Applied; targets must exist; the result carries the warning `no_base`      |
| `rev` unchanged                                                                    | Applied                                                                    |
| `rev` changed, every targeted fingerprint unchanged, every selector resolves alike | Applied on the current tab; the result says `rebased over <n> writes`      |
| A targeted element changed or vanished, or a selector resolves differently         | `409 changeset_conflict`, nothing applied, each element as read and as now |
| `strict: true` and `rev` changed                                                   | `412 stale_tab`, nothing applied                                           |

Elements an operation only shifts to make room are not fingerprinted: a shift commutes with a person's move. When
`rev` changed, a target the base has no fingerprint for (a base carrying only a revision, or a selector now
matching another element) resolves differently. The api never holds what the agent read, so a conflict names each
element by the fingerprint read and the element now; the CLI prints the as-read side from its own cache.

## Held elements

An element a person has selected in an open editor is **held**: every element of their selection, whatever their
role. An agent changeset whose operations target a held element is refused with `409 elements_held`, naming each
held element and who holds it; nothing is applied. The agent resubmits without those operations, or after the
person lets go. The CLI's `--wait-held <seconds>` retries for it.

- The agent's owner never holds against their own agent: their selection is what the `selected` selector reads.
- People outrank agents, not each other: a changeset without a token (a person's revert) is never held.

The room's answer is the source; when the room cannot be reached, nothing counts as held and the api logs it.

## Revert

- `POST /api/documents/:id/changesets/:changesetId/revert` applies the changeset's inverse as a new changeset by the
  reverter. An element changed since the changeset (its fingerprint differs from the after-image) is left as it is
  and listed as `kept`; the rest are reverted.
- The editor's toast offers **Undo**, which is this revert. Personal Ctrl+Z never reverts an agent's changeset
  ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), locked decision 1).
- A changeset can be reverted while its record exists: `CHANGESET_RETENTION_DAYS` after it landed.
- Anyone with edit access to the tab may revert.
- Reverting a changeset that created a tab empties the tab and keeps it. Reverting one twice keeps every element
  (each changed since) and writes nothing.
- The history is `GET /api/documents/:id/changesets`, one changeset's `GET`, and the CLI's `changeset ls` and
  `changeset show`; the editor has no history surface.

## In the editor

- The element ops apply as a peer's would and fold into the save baseline, so the next autosave carries them. The
  revision a save sends as `X-Changeset-Seen` is the one its own snapshot holds, never one that arrived after it.
- An editor joining its room reads the document's newest changesets and re-reads, in place, any open tab it is
  behind on: a changeset relayed before it joined (a first join replays no log), or one whose relay never arrived,
  reaches the screen without a reload. What it brings is not outlined or toasted.
- Each element the changeset touched shows an outline in the owner's colour for `CHANGESET_REVEAL_MS`; with reduced
  motion it appears and disappears without animation.
- A toast names the person and the change: "Webber changed 3 elements: add payment service · Show · Undo" (the
  summary of the latest changeset in it, when it has one; adds and removals count as changed). **Show** brings the
  touched elements into view; **Undo** reverts. Changesets from one token within `CHANGESET_TOAST_COALESCE_MS`
  share a toast, and Undo on it reverts each, newest first. After Undo it reads "Undone", or "Undone, 2 kept
  because they changed since".
- The toast stays until dismissed; a newer burst from the same token replaces it. It is an information toast, so
  the "Show notifications" preference silences it; the outline still shows.

## The MCP server

`update_document` and `add_tab` submit changesets instead of tab `PUT`s ([MCP server](../015-api/mcp-server.md)).
`update_document` in `ops` mode sends its ops as edit operations with a base, so the read-to-write gap no longer
erases anything:

- It takes an optional `rev`, the revision `read_document` returned; the fingerprints come from the tool's own read
  at call time. A person's change between `read_document` and the call is overwritten only on the fields the ops
  set.
- `remove` is the edit operation `rm`: arrows pinned to the element go with it and are listed.
- Landing event-storming notes on lanes and coercing shapes are the engine's, for every front door.
- `rename_document` with a tab renames through the tab name route.

## Limits

| Constant                      | Value      | Why                                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------------ |
| `CHANGESET_MAX_OPERATIONS`    | 500        | A full tab rebuild of a large diagram fits; a runaway loop does not      |
| `CHANGESET_RELAY_MAX_BYTES`   | 192 KiB    | Under the room's 256 KiB frame cap with room for metadata                |
| `CHANGESET_MERGE_WINDOW`      | 10 minutes | Covers a pre-spec bundle until the new-version prompt reloads it         |
| `CHANGESET_RETENTION_DAYS`    | 30         | Matches the Trash: an agent's work can be undone as long as a delete can |
| `CHANGESET_REVEAL_MS`         | 2000       | Long enough to notice, short enough not to clutter                       |
| `CHANGESET_TOAST_COALESCE_MS` | 10000      | One toast per burst of work                                              |

A changeset's element ops, inverse and result lines are stored beside its record, one D1 row each, so only the tab
cap bounds a changeset.

Changesets count against the token's write rate limit ([Public API and API tokens](../015-api/public-api-and-tokens.md) §3.5).

## Observability and telemetry

- Logs: `[changeset] applied`, `[changeset] conflict`, `[changeset] held`, `[changeset] relay-failed`,
  `[changeset] merged-on-save`, `[changeset] superseded-on-save`, `[changeset] reverted`, each with the document,
  tab, changeset id and counts, never content.
- Telemetry: category `Agent`, actions `Applied`, `Conflicted`, `Held`, `Reverted`, type the front door (`Mcp`,
  `Cli`, `Api`, or `Editor` for the toast's Undo) ([Telemetry](../017-telemetry/telemetry.md)). The toast's Show
  tracks `Agent` / `Opened` / `Toast`.
