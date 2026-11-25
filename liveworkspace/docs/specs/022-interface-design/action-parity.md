# Action parity

Status: shipped (Work Tracker 1434)

## What

The seven apps (livediagram, liveplanner, livedocuments, livedesign, livehuddle, liveknowledge, and the Explorer on
liveworkspace.app) share most of what a person does to a whole item: share it, rename it, duplicate it, move it to the
Trash, restore it, export it, search, open something recent and copy its link. Someone moving between two apps meets
each of these in the same place, under the same name, on the same key, and is told it worked in the same way. The
pitch of liveworkspace is one workspace of several apps; an action that moves or changes its name between them makes
them feel like strangers.

## The rule

- **One home, one label.** An action every app has is drawn by one shared component or named by one shared helper
  (`@liveworkspace/explorer`, `@liveworkspace/workbench`, `@liveworkspace/community-ui`, `@liveworkspace/settings`).
  An app never keeps its own copy of one; only the word for its item ("Canvas", "Plan", "Space") is its own, from
  `APP_ITEMS[app].noun` (`packages/sites`).
- **Labels follow the surface, not the app.** A menu on the item itself (the Explorer's ⋯ menu, the tab's menu) says
  the bare verb: Rename, Duplicate, Share, Restore, Export. A list of commands for the whole editor (Search &
  Commands) names the thing too: Rename Canvas, Share Plan, Delete Space, Export…. Moving an item to the Trash is
  **Delete <Noun>** on every surface (the Trash keeps it, and Restore and the Undo say so); **Delete Forever** is the
  one that cannot be undone.
- **One key, listed the same.** A key that works in every app is listed in one shared section of the Keyboard list,
  **In Every App**, first in every editor's Settings, from one module: the same rows, in the same order, with the same
  words, in each. An app's own keys follow it in sections of its own.
- **One kind of feedback.** A change that leaves the screen says so in a toast (the one toast, [Toasts](../016-notifications/toasts.md)):
  moved to the Trash (with Undo), restored, made a copy, moved. A change that shows on screen says nothing more: a new
  name in place, a copy button turning into Copied, an item reopening.
- **Not here:** whether a destructive action asks first or offers Undo afterwards is
  [Toasts](../016-notifications/toasts.md)' and each product's `destructive-actions.md`'s (Work Tracker 1435 moves
  restorable deletes from a confirm to an Undo toast). Parity keeps whichever it is the same across apps.

## The matrix

What a person meets for each action today. "Every editor" is the six product editors; "Explorer" is liveworkspace.app's
`/explorer`, each app's `/explorer` and the Explorer panel inside each editor, which are one component
(`@liveworkspace/explorer`), so they never differ. `<Noun>` is the app's word for its item (Canvas, Plan, Document,
Design, Space, Knowledgebase).

| Action | Where (Explorer) | Where (every editor) | Label | Shortcut | Feedback |
| --- | --- | --- | --- | --- | --- |
| Share | ⋯ menu | Share button in the header's corner card; Search & Commands | Share; Share <Noun> | none | the Share dialog opens |
| Rename | ⋯ menu (typed in the row) | Search & Commands (typed in the Explorer panel) | Rename; Rename <Noun> | none | the new name in place; a refusal toasts and puts the old name back |
| Duplicate | ⋯ menu | Copy in the corner card and Make a Copy in the Community bar, for someone who cannot edit it | Duplicate; Make a Copy | none | toast "Made “<title> (copy)”."; a copy made from the editor opens |
| Move to Trash | ⋯ menu | Search & Commands | Delete <Noun> | none | the row slides out, toast "Moved “<title>” to the Trash." with Undo; from the editor, the Explorer opens with that toast |
| Restore | Trash's ⋯ menu | the deleted card, when the open item is in the Trash | Restore | none | toast "“<title>” restored."; in the editor the item reopens |
| Export | not offered (it is a tab's) | the tab's menu; Search & Commands | Export; Export… | none | the Export dialog, then a download or Copied |
| Search | the footer's Search | the footer's Search | Search & Commands | ⌘ K (or ⌘ .), Ctrl on Windows and Linux | the Search panel opens |
| Open recent | Home's Recent timeline | the Explorer panel's Home, Recent | Recent | none | the item opens |
| Copy link | Share dialog | Share dialog (the same one) | Copy Link | none | the button says Copied |

Where an app adds to these, it adds the same way in each: liveknowledge's page tree has Rename, Duplicate, Copy Link
and Delete on a page's row (a page is its tab), and a tab's menu has Rename, Duplicate, Delete and Export in every
editor.

### Shortcuts

The keys the matrix names, and the two every editor shares with them, are the **In Every App** section of every
editor's Keyboard list:

| Keys | Label |
| --- | --- |
| ⌘ K | Search & Commands (or ⌘ .) |
| ⌘ Z | Undo |
| ⌘ ⇧ Z | Redo (or Ctrl Y) |

The Explorer on liveworkspace.app has no Keyboard list; it binds the same ⌘ K and ⌘ . to the same panel.

## Gaps found, and how each was closed

The survey (2026-11-25) against main found the labels of the matrix already the same in every app: each surface was
shared or hand-kept to match. What differed was where the hand-keeping could drift, and one label:

- **The Keyboard list.** Each editor kept its own copy of the Search, Undo and Redo rows, and liveknowledge listed
  ⌘ K as "Search: This Knowledgebase First" with ⌘ . on a row of its own, though both open the same Search &
  Commands panel, with that knowledgebase's results first. Now: one In Every App section, from one module, first in
  every editor's list; a test fails when an app restates those rows or leaves the section out.
- **The deleted card (Restore).** livediagram, livedocuments, livehuddle and liveknowledge each drew their own copy of
  the card livedesign and liveplanner take from the workbench. Now every editor binds the workbench's card with its
  noun, and the card says how long an empty item waited where the app has that rule ("It was empty for 30 days").
- **The Community bar (Make a Copy).** livediagram, livedocuments, livedesign, livehuddle and liveknowledge each kept a
  copy of the bar liveplanner takes from `@liveworkspace/community-ui`. Now every editor binds the shared bar,
  naming only its own Edit Your <Noun>.
- **The command names.** Share <Noun>, Rename <Noun> and Delete <Noun> were typed out by hand in each editor's
  command list. Now each takes them from one helper over its noun, so a new app or a renamed noun cannot drift.
