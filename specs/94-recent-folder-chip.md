# 94 — Folder location on Recent rows

Status: shipped

## What

Every row and card in the Explorer's **Recent** view carries a small chip
naming the folder the diagram lives in. Clicking it goes to that folder
instead of opening the diagram.

Recent is the one pane that spans folders, so without this there is no way to
tell a "Q3 plan" filed in Design from one in Archive without opening it.

## Immediate parent only

One folder name, not a breadcrumb and not a full path. Folders nest
arbitrarily deep, so a path would be unbounded on a row that has to stay
compact, and the containing folder is the identifying bit in practice. A
two-level breadcrumb was considered for disambiguating repeated names
("Archive"), but it costs width on every row to fix an occasional collision.

Special cases:

- **No folder** still shows a location: `Unsorted`, linking to that synthetic
  view. "Filed nowhere" is information too.
- **Team diagrams** name the **team** and open its library. A team diagram's
  folder lives in the team's own tree, which the personal `folderById` index
  doesn't cover — and for a team row the team is the location that matters.
- **Shared-with-you rows get no chip.** They carry no `folderId` at all: they
  live in the sharer's library, not yours, so any label would be a guess.

## Not a badge

The chip is deliberately _not_ the `badgeBase` treatment used by Offline /
Shared / Team / Private. Those are uppercase, ring-outlined statements about
the diagram; this is a quiet lower-case location that happens to be
clickable, so it reads as a link rather than competing with them for the same
attention. It also hides below `sm` in the list view, where the row has no
width to spare.

The click `preventDefault()`s and `stopPropagation()`s: the whole row is a
link to the diagram, so without that the chip would open the diagram it is
supposed to navigate away from.

## Scope: the Explorer page only

The editor's floating Explorer panel does **not** get the chip.

Its Recent list is five rows in a ~256 px rail, where a chip would crowd out
the thing you came for — the diagram name. Its folder sections are also
expandable accordions rather than routes, so "click to go to the folder" has
no natural destination there short of navigating out of the editor entirely,
which is a heavy thing to do from a side panel. The panel also has no
`folderById` index, so this would mean building one for a chip that doesn't
fit.

Worth revisiting if the panel ever grows a routable folder view.

## Where it lives

- `FolderChip` — `apps/live/app/explorer/diagram-row-shared.tsx`, beside
  `VisibilityBadge`, so the list row and the card can't drift.
- The resolver — `folderChipFor` in `apps/live/app/explorer/ExplorerPane.tsx`,
  which is also where the "Recent only" gate lives. Rows and cards take a
  ready-made `{ label, onOpen }` (or null) rather than resolving names
  themselves, so the naming rules stay in one place.
