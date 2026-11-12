# The start panel

An empty tab starts from a choice, not a blank page and a modal: **Start Planning**
([Plan mode](../026-plan/plan-mode.md#starting-a-board)), a wide panel in the middle of the canvas, its rail of groups
beside a grid of cards, so the boards, sheets, forms, layouts and templates sit where the work begins. This spec is
the panel itself (`StartPanel`, `apps/editor/components/start/StartPanel.tsx`, this app's binding of the panel every editor shares, `../packages/workbench/src/components/start/StartPanel.tsx`); what Start Planning offers is
[Plan mode](../026-plan/plan-mode.md#starting-a-board) (`components/plan/start/StartPlanning.tsx`).

Start Planning is the panel's one start: there is no mode switch and no other mode's start
([Editor mode](editor-modes.md#other-mode-ids)), and it cannot be closed.

## The panel

- **Header:** over the app's own band ([The header band](#the-header-band)), a title mark, then the title, one line under it, the search box, and in the top right corner the **Help** link. On a
  phone the search takes its own row under the title, the help staying beside the title.
- **Rail:** **Recommended** and the start's groups, each with its glyph and count; long names wrap beside the glyph
  on a wide rail. The chosen group's count sits on a pill tinted with the accent, in the panel's ink: the accent on
  its own tint fell to 3.6:1 in dark.
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
- **Keyboard:** the search is focused on a fine pointer, as the panel opens, unless focus has gone somewhere since: the
  panel's code loads when it is first drawn, so on a busy machine it can arrive after a control was reached or a menu
  opened from the keyboard, and it never takes focus from one. It takes it only from the page itself or the canvas
  (`focusIsFree`, `../packages/workbench/src/lib/focus-is-free.ts`). Up and Down move along the rail, choosing as they go. Down
  in the search box moves to the first card it found. Among the cards the arrow keys move between them: Left and Right
  to the card before and after (across a section's end into the next), Up and Down to the nearest card in the row
  above and below; Up from the first row goes back to the search box while there is a search. Home and End reach the
  first and last card (`start-card-keys.ts`).
- **Undo and redo reach the editor through an empty search.** An undo that takes a tab back to empty (a template
  picked, then undone) brings the start back with its search focused, where Cmd/Ctrl+Z and redo were the text box's
  own and did nothing, so the template could not be redone from the keyboard. While the search is empty those chords
  are the editor's (`data-editor-history` on the box, `passesHistoryChords` in `../packages/workbench/src/lib/typing-target.ts`); once something
  is typed in it they undo the typing, as in any text box. A **paste** of canvas content reaches the editor the same
  way: elements copied from another tab (or an image) pasted on a new tab land on the canvas, rather than their JSON
  landing in the search. Pasted text still searches.

## When it shows

To someone who can edit (an **Editor**), after hydration, outside zen and an embed, while the tab is empty (no
elements; a Dashboard with no rows, a Form tab with no form). A **Participant** or **Viewer** sees an empty tab as it is.
A new tab and a new Project open on it.

## Default folders

A template picked here on a project `/new` just made goes to that template's default folder, unless the project was
made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default folders](../013-workspace/default-folders.md)
"A template picked after creation"). The move is `useTemplatePickMove` (`components/start/useTemplatePickMove.ts`): once per plan, and it asks the
index anything only for a pick on a noted plan, of a template with a family.

## Search handed over

A `/new?q=<words>` link hands its words to the new Project's Start Planning as its search, so the choices it meant are
the ones shown. They are kept for the browser tab only and read once (`start-query.ts`).

## The header band

The header is drawn over the app's own band: its Explorer hero backdrop ([The start header wears the same
theme](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#the-start-header-wears-the-same-theme)), redrawn
at a header's height by the shared `StartHeaderBand`
(`../packages/workbench/src/components/start/StartHeaderBand.tsx`), which the panel asks for with
`useStartHeaderTheme('liveplanner', palette)`. Which backdrop is whose, the title's face and the textures' measures
are the hero's own theme (`@liveworkspace/explorer/hero-theme`), so the start and the Explorer read as one app.

- **The motif.** **Board lanes**: four lanes the band's full height, alternate ones a shade deeper; from `xl`, a card
  mid-drag in the gap, tilted, over the dashed slot it will drop into, bobbing twice as the panel arrives (the empty
  states' float). The title mark is three lanes, as full as a board midweek.
- **In the panel's colours.** The band paints in the start palette, never the brand ramp: each of its colours is the
  palette's accent mixed into its card (`start-band-colours.ts`), so it follows the app's light or dark look; a tab's
  theme never reaches it. The ground leans back until the title and the line read at WCAG AA
  (4.5:1) on every patch they can sit over (the paper and its two deeper shades); the line keeps the palette's muted
  where it reads there, else leans toward the ink. The help link keeps its own ink.
- **The title.** A title mark leads it: a 36px tile (32px on a phone) in the band's deeper shade, holding the motif as
  one glyph in the accent (`StartTitleMark`). The title is set in the hero's face at 20px (18px on a phone): the heavy
  face, tracked in (`startHeadingFace`).
- **Its height.** From `sm` the header stands 100px tall (owner, 2026-11-10), its row centred in it, so the band has
  room to show its texture and pieces; on a phone it stays compact (below).
- **Where the pieces show.** The texture and the corner pieces at every size; the gap piece only from `xl`, where the
  panel is at its widest; there the line wraps at 30rem, two lines inside the 100px, so it ends short of the piece
  and the two never meet.
- **The search** keeps its own paper and border over the band, lifted by a small shadow, so it still reads as the
  field.
- **On a phone** the band runs up under the grab handle, so the sheet's top is the band's colour, the handle
  standing over it. The header stays as compact as before: the title row with its mark, then the search.
- **Hidden and cheap.** The band is `aria-hidden` and takes no pointer events. It is CSS gradients and a few small
  inline SVGs: no image, font, filter or blur, nothing fetched, painted once. At most the one motion above, two or
  three times over, then still; none under reduced motion.

## Look

- **The app's colours, never the tab's.** The panel wears the app's own light or dark look (Appearance, not the
  tab's paper), its accent the app's brand colour, whatever theme the tab wears (owner, 2026-11-10: a tab's theme must
  never reach the start, so each app's themed header band stays its own). `useStartPalette` reads only Appearance.
  The tours wear the same palette.
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced motion),
  and its cards and rail cascade in after it (`lvd-cascade`). A panel that replaces another start a moment after
  (another empty tab's) arrives whole, without the rise.
- **On a phone** the panel is a sheet risen from the bottom (`animate-sheet-up`), full width below the top bar,
  standing on the tab bar, with the grab handle every phone sheet has; dragged, it settles back, as it cannot close.
  The tab bar stays in reach, so a new tab's start never leaves the project's other tabs out of reach. Where the bar
  stands is measured, as the toast stack measures its floor (`useChromeFloor`).
- **On a short window** (under 500px tall, whatever the pointer: a phone held sideways, or a laptop zoomed to 200%,
  720×450) the panel clears less above and lies over the bottom cluster (the overlay layer), standing on the tab bar
  while it shows.

## Telemetry

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`. There are no other
modes' results, so `UI · Used · StartOtherMode` is not sent.

## Tests

- `../packages/workbench/src/components/start/start-band-colours.test.ts`: the band's title and line read at AA on
  every ground, light, dark and themed; a palette that is not plain hex keeps a flat band.
- `../packages/workbench/src/components/start/StartHeaderBand.test.tsx`: each app's band and title mark, hidden from
  screen readers; the gap piece only from `xl`; the band under the grab handle on a phone.
- `../packages/explorer/src/hero/hero-theme.test.ts`: every app its own backdrop, none the All Apps dots; only the
  Typesetter in serif.
- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `../packages/workbench/src/components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `../packages/workbench/src/components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
