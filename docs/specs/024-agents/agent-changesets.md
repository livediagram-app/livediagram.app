# Agent changesets

**Status: specified, not built.** Closes livediagram-app/livediagram.app#343.

Every agent write to a tab is a **changeset**: one atomic write, applied by the api, sequenced by the document's
room, shown live to everyone with the tab open, attributed to "<agent name> for <person>", and revertable as one
unit. The whole-tab `PUT` stays the editor's own autosave path and nothing else's.

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
| `agent`      | The token id, the **agent name** (the token's name) and the owner id; absent when a signed-in session writes    |
| `summary`    | Optional, up to 80 characters, written by the agent ("add payment service"); shown in the toast and the history |
| `body`       | Either ordered [edit operations](edit-operations.md), or one `replace` (graph, Mermaid, template or elements)   |
| `base`       | Optional: the tab revision the agent read, and a fingerprint of every element the operations target             |
| `rev`        | The tab revision the changeset produced                                                                         |
| `elementOps` | The `ElementOp`s it compiled to (`add`, `update`, `remove`, `reorder`), the unit the room and editors apply     |
| `inverse`    | The element ops that undo it, computed from the before-images                                                   |

- **Atomic.** Every operation lands or none does. A rejected changeset writes nothing and says why.
- **One tab, one changeset.** A new tab is a changeset that creates it (`replace` on a tab id the document lacks).
- **A new document** is not a changeset: nothing else can hold it yet. `POST /api/documents` stays as it is.

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
7. **Relay** it to the room as one sequenced `changeset` op. A relay failure is logged and never fails the write:
   D1 already holds it, and step 8 keeps it there.
8. **Merge on save.** An editor's tab `PUT` carries `X-Changeset-Seen: <rev>`, the highest changeset revision it has
   applied. The api re-applies every recorded changeset after that revision to the incoming tab before writing,
   element by element:
   - an element the changeset **added** and the save lacks is added back;
   - an element the changeset **changed or removed** takes the changeset's version only when the save still holds
     the element exactly as the changeset found it (its before-image fingerprint). A save holding anything else
     changed it after, so the person's version stands.
     A save without the header (a bundle older than this spec) is treated as having seen nothing newer than
     `CHANGESET_MERGE_WINDOW` ago.

Because the merge reads D1 rather than the room, a changeset survives a dropped relay, a sleeping room and an
editor that was offline when it landed.

## What the room does

- Sequences the `changeset` op in one log slot, whatever its size, carrying `id`, `rev`, the agent name, the owner's
  name and colour, the summary and the element ops.
- When the element ops exceed `CHANGESET_RELAY_MAX_BYTES`, the op carries no element ops and editors re-fetch the
  tab in place, as a resync does ([Resync without reloading the page](../012-collaboration/resync-without-reload.md)).
- Answers the api's internal `GET /selections?tab=<tabId>`: the elements each connected person has selected.

## Rooms for personal documents

An editor connects to its document's room for every server-stored document it has open, personal ones included.
A document in Offline Mode or This browser has no room and no agent can reach it.

## Conflicts

The api compares the changeset's base with the stored tab:

| Situation                                                                          | Result                                                                     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No base                                                                            | Applied; targets must exist; the result carries the warning `no_base`      |
| `rev` unchanged                                                                    | Applied                                                                    |
| `rev` changed, every targeted fingerprint unchanged, every selector resolves alike | Applied on the current tab; the result says `rebased over <n> writes`      |
| A targeted element changed or vanished, or a selector resolves differently         | `409 changeset_conflict`, nothing applied, each element as read and as now |
| `strict: true` and `rev` changed                                                   | `412 stale_tab`, nothing applied                                           |

Elements an operation only shifts to make room are not fingerprinted: a shift commutes with a person's move.

## Held elements

An element a person has selected in an open editor is **held**. A changeset whose operations target a held element
is refused with `409 elements_held`, naming each held element and who holds it; nothing is applied. The agent
resubmits without those operations, or after the person lets go. The CLI's `--wait-held <seconds>` retries for it.

The room's answer is the source; when the room cannot be reached, nothing counts as held and the api logs it.

## Revert

- `POST /api/documents/:id/changesets/:changesetId/revert` applies the changeset's inverse as a new changeset by the
  reverter. An element changed since the changeset (its fingerprint differs from the after-image) is left as it is
  and listed as `kept`; the rest are reverted.
- The editor's toast offers **Undo**, which is this revert. Personal Ctrl+Z never reverts an agent's changeset
  ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), locked decision 1).
- A changeset can be reverted while its record exists: `CHANGESET_RETENTION_DAYS` after it landed.
- Anyone with edit access to the tab may revert.

## In the editor

- The element ops apply as a peer's would and fold into the save baseline, so the next autosave carries them.
- Each element the changeset touched shows an outline in the agent's colour for `CHANGESET_REVEAL_MS`; with reduced
  motion it appears and disappears without animation.
- A toast names the agent and the change: "Claude for Webber changed 3 elements · Show · Undo". **Show** brings the
  touched elements into view; **Undo** reverts. Changesets from one agent within `CHANGESET_TOAST_COALESCE_MS`
  share a toast.

## The MCP server

`update_document` and `add_tab` submit changesets instead of tab `PUT`s ([MCP server](../015-api/mcp-server.md)).
`update_document` in `ops` mode sends its ops as edit operations with a base, so the read-to-write gap no longer
erases anything.

## Limits

| Constant                      | Value      | Why                                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------------ |
| `CHANGESET_MAX_OPERATIONS`    | 500        | A full tab rebuild of a large diagram fits; a runaway loop does not      |
| `CHANGESET_RELAY_MAX_BYTES`   | 192 KiB    | Under the room's 256 KiB frame cap with room for metadata                |
| `CHANGESET_MERGE_WINDOW`      | 10 minutes | Covers a pre-spec bundle until the new-version prompt reloads it         |
| `CHANGESET_RETENTION_DAYS`    | 30         | Matches the Trash: an agent's work can be undone as long as a delete can |
| `CHANGESET_REVEAL_MS`         | 2000       | Long enough to notice, short enough not to clutter                       |
| `CHANGESET_TOAST_COALESCE_MS` | 10000      | One toast per burst of work                                              |

Changesets count against the token's write rate limit ([Public API and API tokens](../015-api/public-api-and-tokens.md) §3.5).

## Observability and telemetry

- Logs: `[changeset] applied`, `[changeset] conflict`, `[changeset] held`, `[changeset] relay-failed`,
  `[changeset] merged-on-save`, `[changeset] superseded-on-save`, `[changeset] reverted`, each with the document,
  tab, changeset id and counts, never content.
- Telemetry: category `Agent`, actions `Applied`, `Conflicted`, `Held`, `Reverted`, type the front door (`Mcp`,
  `Cli`, `Api`) ([Telemetry](../017-telemetry/telemetry.md)).
