# Editor preferences

Every editor (livediagram, livedesign, livedocuments, livehuddle, liveknowledge and liveplanner) keeps a person's
settings two ways: the account's copy, held by the accounts Worker ([accounts.md](../003-accounts/accounts.md)
"Settings") and reached through the app's own `/api/preferences`, and a warm copy in the browser, so the editor never
waits on the network to read one. What each setting means, its key and its default is each product's
`docs/specs/007-editor/user-preferences.md`. This page is the part all six share: how the two copies are read, merged,
written and kept in step. One copy holds it, in `@liveworkspace/workbench` (Work Tracker 1414); each editor binds it
with its own keys, its own trim and its own api calls.

The six editors held their own copies until November 2026, and the copies had drifted (two debounced their saves, two
did not; each named its test seams differently). All six merged a load the same way, and the same wrong way: the
server's copy laid over the browser's, so a key the server no longer held lived on in the browser. A setting cleared by
deleting its key (a reset, or another device clearing it) never cleared on a device that had saved it.

## The copies

- **The browser's copy**, `<app>:user-preferences:v1` in `localStorage`: the whole flat object, the shared keys and
  the app's own side by side. Read synchronously, so the first render already has it.
- **The account's copy**, what `GET /api/preferences` answers: the same flat object, joined from the `all` scope and the
  app's own.
- **The last copy agreed**, `<app>:user-preferences:server` in `localStorage`: the account's copy as this browser last
  knew it, for one owner (`{ ownerId, prefs }`). Written when a load's answer arrives and when a save is confirmed.
  It is what lets a merge tell a setting this device changed from one the server changed or removed.
- **The unsaved mark**, `<app>:user-preferences:unsynced`: the owner id whose change this browser holds and the server
  has not confirmed. The guest Settings in the Explorer sets it too ([site.md](../010-site/site.md#settings) "A guest").

The key names are each app's for good: renaming one would strand a person's settings in the old one.

## Loading

Once per page load and owner: the Explorer and then the editor it opens both ask, and the second waits for the first's
answer and then reads the browser's copy. A failed read is asked again the next time; an answer stands for the page.

The answer is merged with the browser's copy key by key, against the last copy agreed:

- **A key this device has not changed** (its value is the agreed one, or it is absent from both) takes the server's
  value, and **is dropped when the server no longer holds it**. That is how a cleared setting reaches every device.
- **A key only this device changed** (the server's value is still the agreed one) keeps this device's value, a removal
  included.
- **A key both changed** takes this device's value while it holds an unsaved change (the unsaved mark is this owner's),
  and the server's otherwise.

A key the server never held is never dropped: a change made before anyone was known (a first visit before the guest
identity arrives, a document kept Offline opening as `self`), a key a script set, a workbench frame's own choice. Each
is a key only this device changed.

Without a last copy agreed for this owner (a new device, the first load after this rule arrived, or someone signed in
or out on this browser), nothing tells a key this device added from one the server dropped, so none is dropped: with an
unsaved change every key this device holds wins and the server's fill the rest; otherwise the server's value wins for
every key both hold, and keys only this device holds stay. From that load on the copy is agreed. So a key this device
saved before the rule arrived, and the server dropped since, stays here until it next changes; Work Tracker 1409's
call space is stored as `''` rather than deleted for that reason, and keeps working.

The merged copy is trimmed to fit (below), written to the browser, and the app's `<app>:preferences-changed` event
fires so the page's readers refresh. With an unsaved change, it is then sent, as any change is. The last copy agreed
becomes the server's answer.

A deployment that keeps no preferences (no accounts Worker, or an owner it has no place for) answers so; the browser's
copy is then the only one, nothing is sent for that owner this page load, and the unsaved mark is cleared
(`@liveworkspace/workbench/lib/preferences-local-only` records it for the Settings host). A read that fails (offline,
the api out of reach) leaves the browser's copy as it is.

## Writing

A change is built on the freshest browser copy, never on a render's snapshot: only the keys the change touched are
applied over it, so a change another tab made meanwhile survives. It is trimmed to fit, written to the browser, and the
change event fires; the browser's own `storage` event carries it to other tabs. With an owner, it is then queued for the
server; without one (or under `self`) it stays in the browser, where the next load keeps it. A workbench frame writes
only to the browser (the frame's choices stay in the frame, [workbench.md](workbench.md)). Every write also mirrors Automatically Open Explorer into
the address's cookie for the router ([one-explorer.md](../004-index/one-explorer.md#opening-on-the-explorer)), except in a
workbench frame.

## Saving

- **Only what changed.** A save sends the keys whose value differs from what the server last confirmed (its answer on
  load, then each save that landed), each whole, and `null` for a key it holds that the change dropped. Before the
  server's copy is known this page load, the whole object goes and nothing is deleted.
- **One at a time, the latest wins.** A change made while a save is in flight waits, replacing any change already
  waiting. An editor may also hold each change for a short pause (`debounceMs`) so a dragged slider is one request; a
  page going away (hidden, or `pagehide`) sends what waits at once.
- **A save that did not land keeps this device's copy.** The unsaved mark is set the moment a change is queued and
  cleared only when a save is confirmed with nothing more waiting, so the next load lets this device's changes win and
  sends them again.

## Fitting

The api refuses a body over 4,096 characters of `{"prefs":...}`. Before a copy is kept or sent it is trimmed: the app's
dead keys go first, whole, in the order it lists them, then, where the app names one, the least recently used entries of
a growable map of `[count, lastUsed]` pairs (livediagram's and livehuddle's shape picks). Every other key is a choice
the person made once and stays whole. A trim logs `[preferences] trimmed to fit dropped=<n> length=<n>`.

## What each editor keeps

Its own `lib/user-preferences.ts` (the `UserPreferences` type with each key's note, its read helpers such as
`panelEnabled`) and `lib/preferences-sync.ts` (its keys, its dead keys, its pause, and the binding to its api client).
Everything above is the shared store's.
