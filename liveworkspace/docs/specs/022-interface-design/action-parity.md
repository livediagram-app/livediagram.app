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

| Action        | Where (Explorer)            | Where (every editor)                                                                         | Label                  | Shortcut                                | Feedback                                                                                                                 |
| ------------- | --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Share         | ⋯ menu                      | Share button in the header's corner card; Search & Commands                                  | Share; Share <Noun>    | none                                    | the Share dialog opens                                                                                                   |
| Rename        | ⋯ menu (typed in the row)   | Search & Commands (typed in the Explorer panel)                                              | Rename; Rename <Noun>  | none                                    | the new name in place; a refusal toasts and puts the old name back                                                       |
| Duplicate     | ⋯ menu                      | Copy in the corner card and Make a Copy in the Community bar, for someone who cannot edit it | Duplicate; Make a Copy | none                                    | toast "Made “<title> (copy)”."; a copy made from the editor opens                                                        |
| Move to Trash | ⋯ menu                      | Search & Commands                                                                            | Delete <Noun>          | none                                    | the row slides out, toast "Moved “<title>” to the Trash." with Undo; from the editor, the Explorer opens with that toast |
| Restore       | Trash's ⋯ menu              | the deleted card, when the open item is in the Trash                                         | Restore                | none                                    | toast "“<title>” restored."; in the editor the item reopens                                                              |
| Export        | not offered (it is a tab's) | the tab's menu; Search & Commands                                                            | Export; Export…        | none                                    | the Export dialog, then a download or Copied                                                                             |
| Search        | the footer's Search         | the footer's Search                                                                          | Search & Commands      | ⌘ K (or ⌘ .), Ctrl on Windows and Linux | the Search panel opens                                                                                                   |
| Open recent   | Home's Recent timeline      | the Explorer panel's Home, Recent                                                            | Recent                 | none                                    | the item opens                                                                                                           |
| Copy link     | Share dialog                | Share dialog (the same one)                                                                  | Copy Link              | none                                    | the button says Copied                                                                                                   |

Where an app adds to these, it adds the same way in each: liveknowledge's page tree has Rename, Duplicate, Copy Link
and Delete on a page's row (a page is its tab), and a tab's menu has Rename, Duplicate, Delete and Export in every
editor.

## The tab menu

The tab's menu (from a tab's ⋯, a right-click on a tab or on the empty canvas, and liveknowledge's canvas right-click
for its page) is one shared menu in every editor. An app hands it only its words (what one tab is called and what
holds the tabs) and the rows only it has; the menu's frame, its order, its labels, its hover cards, where it opens,
how it closes and its phone sheet are the menu's own. A new verb every app offers is added once, in the menu.

**The words.** An app names its item (`tab`, or liveknowledge's `page`) and what holds it (`canvas`, `plan`,
`document`, `design`, `space`, `knowledgebase`). From those come "Rename this tab.", "Create a copy of this tab in this
canvas.", Remove Tab or Remove Page, and the menu's name for a screen reader (Tab menu or Page menu; Canvas menu when
it opens from the canvas). Side by Side adds "Or drag its pill to the right edge." where the item is a tab (a page has
no pill). Add to Another <Noun>'s label is the app's own, since each app has worded it for its own nouns.

**The rows, top to bottom.** One toolbar of icon buttons, a hairline, then full-width rows in groups:

| Part                    | Rows                                                                                                                                                         | Shown                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Toolbar, left           | Rename, Duplicate, Paste (opened from a tab's ⋯ only), Side by Side or Close Side by Side                                                                    | Paste greyed when nothing is copied; Side by Side where a split can open                                       |
| Toolbar, right          | Lock Tab or Unlock Tab, Delete                                                                                                                               | Lock where the app locks tabs; Delete greyed for the last tab and for a locked one                             |
| Paste row               | Paste, under its own hairline                                                                                                                                | opened from the empty canvas only, in place of the toolbar's Paste                                             |
| Organise                | Organise in Tab Folder, then Add to Another <Noun>                                                                                                           | each where the app offers it; Add to Another greyed when there is nowhere to add the tab                       |
| The app's own group     | the app's rows, under a hairline                                                                                                                             | when the app has any (livehuddle's Attendance)                                                                 |
| File                    | Import (or Import…), Export, then the app's own rows, then Clear                                                                                             | Import greyed on a locked tab unless the app says its Import dialog has something to press; Clear greyed empty |
| Connected tab (instead) | Rename (where the tab can keep a name of its own), Connect Again (when it opens nothing), Organise in Tab Folder, the app's own rows, a hairline, Remove Tab | a tab connected to another item ([Connected tabs](../004-index/connected-tabs.md))                             |
| One row only (instead)  | the app's one row                                                                                                                                            | livehuddle's Participant with Attendance                                                                       |

Delete acts at once (the Undo toast brings the tab back, [Undo, not confirm](undo-not-confirm.md)), unless the app
says deleting does what an Undo cannot take back (liveplanner's tab that a form sends responses to): then a confirm
anchored to the Delete button says why. Lock and Delete sit together at the toolbar's right edge; an app without a
lock may spread its toolbar's buttons evenly across the row instead (livehuddle).

**Each app's own.** What only one app has stays that app's, handed to the menu as rows:

| App           | Item, holder        | Lock | Organise                                       | Own rows                                                   |
| ------------- | ------------------- | ---- | ---------------------------------------------- | ---------------------------------------------------------- |
| livediagram   | tab, canvas         | yes  | Tab Folder; Add to Another Canvas              | Make Plan Cards (file group)                               |
| liveplanner   | tab, plan           | yes  | Tab Folder (no Add to Another Plan)            | View As Diagram (file group); Import… with its own dimming |
| livedocuments | tab, document       | yes  | Tab Folder; Add to Document                    | none                                                       |
| livedesign    | tab, design         | yes  | Tab Folder; Add to Design                      | none                                                       |
| livehuddle    | tab, space          | no   | Tab Folder; Add to Another Space               | Attendance (own group); Send Stickies to Plan (file group) |
| liveknowledge | page, knowledgebase | no   | Add to Knowledgebase (the page tree organises) | none                                                       |

**Who sees it.** An Editor gets the whole menu. A Viewer gets none. A Participant gets none, and neither does a tab-scoped edit link
(it edits its one tab's content, nothing around it), except in livehuddle, where either one who may see a tab's
Attendance gets the menu with that one row. The menu itself never decides who sees it: the
tab bar (or liveknowledge's bottom bar) opens it only for those, and each greys what the tab refuses (a locked tab,
the last tab, an empty one).

### Shortcuts

The keys the matrix names, and the two every editor shares with them, are the **In Every App** section of every
editor's Keyboard list:

| Keys  | Label                      |
| ----- | -------------------------- |
| ⌘ K   | Search & Commands (or ⌘ .) |
| ⌘ Z   | Undo                       |
| ⌘ ⇧ Z | Redo (or Ctrl Y)           |

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
- **The tab menu** (Work Tracker 1442). Each editor kept its own copy of the tab's menu, about 450 lines each, the
  same but for a few words and each app's own rows, and each copy kept its own tests. Now every editor binds the
  workbench's one menu with its words and its own rows, and the shared tests run once, against it.
