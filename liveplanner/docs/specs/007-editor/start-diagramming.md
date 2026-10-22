# The start panel

An empty tab starts from a choice, not a blank page and a modal: **Start Planning**
([Plan mode](../026-plan/plan-mode.md#starting-a-board)), a wide panel in the middle of the canvas, its rail of groups
beside a grid of cards, so the boards, sheets, forms, layouts and templates sit where the work begins. This spec is
the panel itself (`StartPanel`, `apps/live/components/start/StartPanel.tsx`); what Start Planning offers is
[Plan mode](../026-plan/plan-mode.md#starting-a-board) (`components/plan/start/StartPlanning.tsx`).

Until 2026-10-22 the panel also drew the template starts of the retired editor modes (Start Diagramming, Start
Drawing, Start a Workshop and Start Making Pages), led by a mode switch, with a search reaching every mode's templates
and a × to close it ([Editor mode](editor-modes.md#retired-modes)). Those went with their modes; Start Planning
remains, and it cannot be closed.

## The panel

- **Header:** the title, one line under it, the search box, and in the top right corner the **Help** link. On a
  phone the search takes its own row under the title, the help staying beside the title.
- **Rail:** **Recommended** and the start's groups, each with its glyph and count; long names wrap beside the glyph
  on a wide rail.
- **Cards:** each choice's picture on a soft plate, its name and its line. Choosing a card acts at once. A template
  lands on the tab painted in the **tab's theme**: the panel picks no theme, so the scaffold takes the colours the tab
  already wears rather than the template's built-in ones. The tab's backdrop is left as it is.
- **Search:** across the start's own choices only; matches are grouped under their group, each once, in rail order.
  Escape clears a search. Nothing found: the shared empty state.
- **A title match leads.** A choice whose name begins with what was typed (case, punctuation and hyphens ignored, as
  the search's own) is listed first, under **Best Match**, and not again under its group: an exact name before a
  longer one, then in the order the groups list them (`best-match.ts`). With no name beginning so, there is no Best
  Match and the groups lead.
- **Picking a category** opens it at the top of its cards, never part way down the last one's.
- **Keyboard:** the search is focused on a fine pointer; Up and Down move along the rail, choosing as they go. Down
  in the search box moves to the first card it found. Among the cards the arrow keys move between them: Left and Right
  to the card before and after (across a section's end into the next), Up and Down to the nearest card in the row
  above and below; Up from the first row goes back to the search box while there is a search. Home and End reach the
  first and last card (`start-card-keys.ts`).
- **Undo and redo reach the editor through an empty search.** An undo that takes a tab back to empty (a template
  picked, then undone) brings the start back with its search focused, where Cmd/Ctrl+Z and redo were the text box's
  own and did nothing, so the template could not be redone from the keyboard. While the search is empty those chords
  are the editor's (`data-editor-history` on the box, `passesHistoryChords` in `lib/typing-target.ts`); once something
  is typed in it they undo the typing, as in any text box. A **paste** of canvas content reaches the editor the same
  way: elements copied from another tab (or an image) pasted on a new tab land on the canvas, rather than their JSON
  landing in the search. Pasted text still searches.

## When it shows

To someone who can edit (an **Editor**), after hydration, outside zen and an embed, while the tab is empty (no
elements; a Dashboard with no rows, a Form tab with no form). A **Participant** or **Viewer** sees an empty tab as it is.
A new tab and a new Project open on it.

While one of the palette's popovers is open, the start **steps aside**: it stays mounted, so its search, its group and
its scroll are kept, but is hidden (`lib/palette-popover-open.ts`; `StartPanel` hides its own root). Plan shows no
palette, so this does not arise there today.

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the document was
made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default folders](../013-workspace/default-folders.md)
"A template picked after creation"). The move loads only at the pick (`useTemplatePickMove`, a dynamic import of
`move-on-template-pick.ts`).

## Search handed over

A `/new?q=<words>` link hands its words to the new Project's Start Planning as its search, so the choices it meant are
the ones shown. They are kept for the browser tab only and read once (`start-query.ts`).

## Look

- **The tab's colours.** The panel's paper is the tab's canvas colour, its accent (the chosen category, the focus ring,
  a card's hover) the theme's stroke and its ink the theme's text, through `planPalette` as a coloured Plan board's,
  which keeps the ink readable on the paper (`start-palette.ts`, `useStartPalette`). A theme with no colours of its own
  (Default) leaves the app's light or dark look. The tours wear the same palette ([Editor tours](editor-tour.md#look)).
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced motion),
  and its cards and rail cascade in after it (`lvd-cascade`). A panel that replaces another start a moment after
  (another empty tab's) arrives whole, without the rise.
- **On a phone** the panel is a sheet risen from the bottom (`animate-sheet-up`), full width below the top bar,
  standing on the tab bar, with the grab handle every phone sheet has; dragged, it settles back, as it cannot close.
  The tab bar stays in reach, so a new tab's start never leaves the document's other tabs out of reach. Where the bar
  stands is measured, as the toast stack measures its floor (`useChromeFloor`).
- **On a short window** (under 500px tall, whatever the pointer: a phone held sideways, or a laptop zoomed to 200%,
  720×450) the panel clears less above and lies over the bottom cluster (the overlay layer), standing on the tab bar
  while it shows.

## Telemetry

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`. `UI · Used · StartOtherMode`, a template
chosen from another mode's results, was retired with the other modes.

## Tests

- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
