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

## Tests to run

`vitest related` on the changed files in each touched package and app, each editor's `shortcut-sections.test.ts`,
`packages/workbench` `exports.test.ts`, and each touched app's guard tests.
