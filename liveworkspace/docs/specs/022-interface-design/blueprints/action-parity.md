# Action parity: blueprint

Derived from [Action parity](../action-parity.md). Paths start at the repo root.

## The In Every App shortcut section

- `packages/workbench/src/lib/shortcut-sections.ts` (`@liveworkspace/workbench/lib/shortcut-sections`): the
  `ShortcutRow` and `ShortcutSection` types every editor's list uses, and `IN_EVERY_APP_SECTION`, heading
  **In Every App**, rows in this order:

  | `keys`            | `label`                       |
  | ----------------- | ----------------------------- |
  | `['⌘', 'K']`      | `Search & Commands  (or ⌘ .)` |
  | `['⌘', 'Z']`      | `Undo`                        |
  | `['⌘', '⇧', 'Z']` | `Redo  (or Ctrl Y)`           |

  Frozen (`Object.freeze` on the section, its rows and each row's keys), so an app cannot edit the shared rows.

- Each editor's `apps/<editor>/components/dialogs/shortcut-sections.ts` (livediagram, liveplanner, livedocuments,
  livedesign's `apps/live`, livehuddle, liveknowledge) imports the types and the section from there, puts the section
  first in `SHORTCUT_SECTIONS`, and lists none of its rows in its own sections. liveplanner's own Everywhere section
  keeps Zen Mode, Escape and F6.
- Guards:
  - `packages/workbench/src/lib/shortcut-sections.test.ts` pins the rows and, reading every product's
    `shortcut-sections.ts` from disk, that each one imports `IN_EVERY_APP_SECTION`, opens `SHORTCUT_SECTIONS` with
    it, and writes none of its labels again. Six editors are expected; a seventh with a Keyboard list joins the scan
    on its own (it reads every `live*/apps/*/components/dialogs/shortcut-sections.ts`).
  - Each editor's `shortcut-sections.test.ts` asserts `SHORTCUT_SECTIONS[0]` is the shared section itself (`toBe`)
    and that no later row repeats one of its labels, alongside its existing checks that every listed key is bound.

## Item command names

- `packages/workbench/src/lib/item-command-names.ts` (`@liveworkspace/workbench/lib/item-command-names`):
  `itemCommandNames(app)` returns `{ share, rename, delete }` as `Share <Noun>`, `Rename <Noun>`, `Delete <Noun>`, the
  noun from `APP_ITEMS[app].noun` (`@liveworkspace/sites`). Each editor's `lib/editor-commands.ts` names its Share,
  Rename and Delete commands from it, once at module load (`ITEM_COMMANDS`).
- Guard: `item-command-names.test.ts` checks the names for every app in `APP_ITEMS`.

## The deleted card (Restore)

- `packages/workbench/src/components/chrome/TrashedCard.tsx` gains `emptyDays?: number`: with it, an item moved for
  being empty reads "It was empty for <n> days, so it moved to the Trash"; without it, "It was empty, so it moved to
  the Trash". `trashedCardLead(row, now, emptyDays?)` carries the same option.
- Each editor's `components/chrome/<Noun>TrashedCard.tsx` is a binding of a few lines: `TrashedCard` with its noun
  (`canvas`, `plan`, `document`, `design`, `space`, `knowledgebase`), and livediagram and livehuddle pass
  `EMPTY_DOCUMENT_STALE_DAYS` (30) from their api schema, as their empty-document cleanup spec says.
- Guard: `TrashedCard.test.tsx` covers the lead with and without `emptyDays`.

## The Community bar (Make a Copy)

- `packages/community-ui/src/editor/CommunityBar.tsx` (`@liveworkspace/community-ui/community-bar`) is the one bar.
  liveplanner renders it directly; each other editor's `components/chrome/CommunityBar.tsx` is a binding of a few
  lines that renders it with `own` set to its own item's address and **Edit Your <Noun>** when the visitor is the
  post's author (`ownDocumentId`, or livedesign's `ownDesignId`). The bar's markup lives only in the package.

## The tab menu

- `packages/workbench/src/components/chrome/TabMenu.tsx` (`@liveworkspace/workbench/components/chrome/TabMenu`):
  `TabMenu`, the shell. It places the menu (above-left of `anchor`, the tab's ⋯, or at `point`, growing up when
  `point.openUp`), clamps it on screen (`clampToViewport`, re-run by a `ResizeObserver`), closes it on an outside
  press, a wheel or a window blur (`useMenuDismiss`) and on Escape (`useControlMenu`), draws a phone's `BottomSheet`
  in its place, swaps itself for the folder or copy-to picker (focus back to `anchor` when the picker closes), and
  draws the Delete confirm (`ConfirmPopover`, "Delete this <item>?") when `deleteWarning` is set. The classes and
  `data-tour-id="tab-menu"` are the copies' own, unchanged.
- `packages/workbench/src/components/chrome/tab-menu-rows.tsx`: the rows (`TabMenuToolbar`, `TabMenuRows`,
  `ConnectedTabMenuRows`), the menu's glyphs (the copies' sizes: pencil and bin 13 px, the lock 12 px, rows at
  `MENU_ICON_PX`), `tabMenuWords(words)` (every string built from the words) and `sideBySideOf(split)`.
- Props (`TabMenuProps`): `words: { item: 'tab' | 'page'; holder: string }`; the verbs `onRename`, `onDuplicate`,
  `onClearContent`, `onImport`, `onExport`, `onDelete` with `canDelete`, `canClearContent`; `locked` and
  `onToggleLock` (the lock button shows only with `onToggleLock`); `canImport` (default `!locked`) and `importLabel`
  (default `Import`); `deleteWarning`; the folder props `folders`, `currentFolder`, `onMoveToFolder`,
  `onRemoveFromFolder`, `onSetFolderColour` (the row shows only with `onMoveToFolder`, and opens the workbench's
  `AddTabToFolderDialog`); `copyTo: { label, disabled, picker(close) }`; `connected` and `renameConnected` (default
  true); `split` (the editor's split view, read structurally: `available`, `pair`, `activeId`, `canOpen`, `open`,
  `close`); the app's rows `ownGroup`, `fileRows`, `connectedRows` and `only`; `toolbar: 'grouped' | 'spread'`.
- Each editor's `components/chrome/TabMenu.tsx` (livediagram, liveplanner, livedocuments, livedesign's `apps/live`,
  livehuddle, liveknowledge) is a binding: `TabMenu` with its words, its split view (`useSplitViewContext()`), its
  copy-to picker (the app's `AddTabTo<Noun>Dialog`) and its own rows. It keeps the props its tab bar already passes, so
  `EllipsisMenuButton` and `TabBar` (liveknowledge's `BottomBar`) only import it by its new name; `TabBar` still loads
  it lazily (`next/dynamic`). The per-app `TabPortalMenu.tsx` copies are gone, and so is liveknowledge's own
  `AddTabToFolderDialog`, which only its copy's unreachable folder row opened.
- Guards:
  - `TabMenu.test.tsx`, `TabMenu.delete.test.tsx`, `TabMenu.dismiss.test.tsx`, `TabMenu.folder.test.tsx`,
    `TabMenu.paste.test.tsx` and `TabMenu.roles.test.tsx` in the workbench: the rows and their order for every part of
    the table, the words, the pickers, Delete with and without its warning, the closing rules, Paste's two places, the
    phone sheet, and what each role's menu holds. Held at 100% (`vitest.config.ts`).
  - Each editor's `components/chrome/TabMenu.test.tsx` pins its menu's labels in order (the "unchanged on screen"
    check) and its own rows (livediagram's Make Plan Cards, liveplanner's View As Diagram and Import…, livehuddle's
    Attendance and Send Stickies to Plan); each editor's `TabPill.test.tsx` keeps its role checks (no menu for a
    Viewer or a Participant; livehuddle's Attendance-only menu).

## Tests to run

`vitest related` on the changed files in each touched package and app, each editor's `shortcut-sections.test.ts`,
`packages/workbench` `exports.test.ts`, and each touched app's guard tests.
