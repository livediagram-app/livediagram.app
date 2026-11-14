# Delta saves

An Editor's autosave of a tab sends only the elements that changed, as element ops, instead of the whole tab. The api
rebuilds the whole tab from the stored copy and the ops, proves the rebuild is exactly the tab the editor holds, and
then saves it through the same path as a whole-tab `PUT`. When anything does not line up, the api refuses the delta
and the editor sends the whole tab, as every save did before (Work Tracker 803).

This is livediagram's delta save (its Delta saves spec, Work Tracker 661, 808 and 810), brought to livedocuments. The
door, the editor's side, the drafts and the announcement are one shared copy every product binds; this spec states
what livedocuments binds and where it differs.

## Why

- Every autosave (600 ms after the last edit, [Per-tab storage](per-tab-storage.md#saving)) `PUT`s the whole tab. A deck or an article of 2,000 elements across its pages sends hundreds of kilobytes each time someone pauses typing; a one-label edit
  is one `update` op of a few hundred bytes. The cost is the upload, which hurts on phones and slow connections.
- The unload flush has a 64 KB keepalive budget; a large tab's whole body cannot ride it. A delta usually can.

## What a delta save is

`POST /api/documents/:id/tabs/:tabId/delta`, a JSON body `{ baseRev, ops, digest, tab }`:

- `baseRev`: the tab revision the editor's base copy is ([Agent changesets](../024-agents/agent-changesets.md));
- `ops`: the element ops that turn the base copy's elements into the editor's (`diffToElementOps`);
- `digest`: SHA-256 (lowercase hex) of `JSON.stringify` of the editor's current elements, as it would send them whole;
- `tab`: every other field of the tab as a whole-tab save would send it (name, kind, mode, layers, settings), no
  elements.

The same headers as the whole-tab save ride with it: `X-Changeset-Seen`, `X-Room-Cursor`, `X-Save-Changes` and `X-Allow-Empty`. The
base copy is the tab exactly as the api stores it at `baseRev`: what a whole save's answer echoes, or what a delta
save's answer confirms; never the editor's own last-sent copy.

## How the api applies it

1. The same doors as the whole-tab save, in its order: an API token is refused `405 use_changesets`; the caller must be
   the owner or hold an edit-role grant on this tab (a tab-scoped link on its own tab only, another tab `403` as the whole save answers it).
2. A malformed body (`baseRev` not a whole number, `digest` not 64 lowercase hex characters, `ops` not well-formed ops,
   `tab` not an object) is `400`.
3. The delta is **refused** `409 delta_refused` with a `reason`, nothing written: `too_many_ops` (more than 500),
   `no_base` (the tab is not stored: a new tab is saved whole), `stale_base` (the stored revision is not `baseRev`) or
   `digest_mismatch` (the stored elements with the ops applied are not, byte for byte, the editor's).
4. Otherwise the rebuilt tab goes through the whole save's path unchanged: the schema gate, the unseen changesets and
   the room's ledger merged in, the name cap, a tab-scoped link's stored name kept ([Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)), the save's change summary (`X-Save-Changes`) merged over the stored tab ([Collaboration race hardening](../012-collaboration/collab-race-hardening.md)), the empty-tab backstop, the comment authors,
   the write at the revision read, the comment emails, mentions and pushes.
5. It answers `200 { rev, digest }`: the revision written and the digest of the elements now stored. When the digest is
   the one sent, they are the editor's next base copy; otherwise (the save merged something in) its next save is
   whole.

A delta is only ever stored when it rebuilds exactly the tab a whole save would have sent, so a wrong base copy or a
bug in applying ops can only ever cost a fallback, never a tab.

## How the editor uses it

- The editor holds a base copy per tab (at most 16 tabs, the most recently used) from the tab's load (the elements as
  the api answered them, before the load's own fixes), a whole save's echo, a delta answer whose digest is the one
  sent, or a peer's announced save it proves (below). An older revision never replaces a newer copy; a refusal or a
  differing digest drops it.
- An Editor's save sends a delta when the editor holds a base copy and the delta is small: at most 500 ops and a body
  at most half the size of the elements sent whole. Otherwise, and for a new tab, it sends the whole tab.
- A `409 delta_refused` is answered at once with the whole save, in the same save. Every other failure is a failed
  save, retried as today; the whole save's own refusals reach the editor from a delta exactly as from the whole save.
- The unload flush sends a delta where it has one, as a `keepalive` request when it fits what is left of the 60 KB
  budget; otherwise the tab goes whole as before. A refused flushed delta is followed by the whole tab when the page
  lives on to hear the refusal.
- An offline document (This Browser) never sends one: it has no api. Comments a Participant or a Viewer posts, and the other subresource writes, are their own routes and are unchanged.

## A peer's save moves the base copy

Two Editors on one big tab each hold a base copy, and each save moves only the saver's forward. So once an Editor's
save of a tab lands and its element ops are relayed, the editor sends one more room op, `tab-saved { tabId, rev,
digest }`, after the ops on the same socket. A peer hashes the tab as its autosave baseline holds it; only when that
digest is the announced one does it hold those elements as its base copy at `rev`. A wrong or forged announcement only
fails the digest, or moves the copy to a revision the api then refuses `stale_base`: the next save is whole. The room
sequences `tab-saved` as a mutation op (after the save's ops, logged for a reconnecting peer's catch-up), relays it
only from an Editor, and the room's ledger does not track it.

## Drafts of unsaved changes

The unload flush writes a draft of each tab it sends (an Editor's, of a cloud document, over a held base copy) in this
browser's IndexedDB, in a database of its own (`livedocuments-drafts`), before anything is sent. A later save of the tab
that lands removes it. On the next load of that tab for the same person:

- the stored tab already holds the draft's change: the draft is removed, nothing is said;
- the api still holds the draft's revision: the draft goes on screen as an unsaved edit over the stored tab, so the
  autosave saves it, and a toast says "Restored your last unsaved edit to “Tab name”." A tab already edited since its
  load keeps those edits, and the draft is removed;
- somebody saved the tab since: the draft is removed and a warning toast says "Couldn't apply your last unsaved edit to
  “Tab name”: the tab changed since."

A draft over 4,000,000 characters is not kept. A browser without IndexedDB keeps no drafts and works as before.

## Share roles

- **Editor**: sends delta saves exactly where a whole-tab save is allowed, announces its saves, moves its base copy
  from a peer's, and writes the unload flush's drafts.
- **Participant**: never sends one; its changes go to the room as ops ([Share roles](../013-workspace/share-roles.md)).
  The door refuses it `403` as the whole save does. Its `tab-saved` is dropped by the room, and it keeps no draft.
- **Viewer**: refused `403`. Sends no `tab-saved` and keeps no draft.

## What this does not change

The whole-tab `PUT` stays for every save the delta path does not take. What is stored, the tab revision, the changesets
and the room are unchanged.
