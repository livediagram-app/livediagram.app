# Template start: Start Making Pages

An empty tab starts from a choice, not a blank page and a modal. Every new tab offers **Start Making Pages**: a wide
panel in the middle of the canvas, its rail of groups beside a grid of the Pages templates, so the templates sit
where the work begins instead of in a step before it. The New Design route asks for nothing first
([New design route](new-design-route.md)), and the design opens on its tab's start.

## The panel

`StartPanel` (`apps/live/components/start/StartPanel.tsx`) draws the start; the start says what its groups and cards
are, the panel draws them.

- **Header:** the title ("Start Making Pages"), one line under it, the search box, and in the top right corner the
  **Help** link and **Close** (×). On a phone the search takes its own row under the title, the help and × staying
  beside the title.
- **Rail:** **Recommended**, then the groups, each with its glyph and count; long names wrap beside the glyph on a
  wide rail. The chosen group's count sits on a pill tinted with the accent, in the panel's ink: the accent on its own
  tint fell under WCAG AA.
- **Cards:** each template's preview on a soft plate, its name and its description in full. Choosing a card lands
  the template on the tab at once (`chooseTemplate`), painted in the **tab's theme**: the panel picks no theme, so
  the scaffold takes the colours the tab already wears (its own theme, or the one a new tab inherited from the tab it
  was added beside) rather than the template's built-in ones. The tab's backdrop is left as it is.
- **Search:** the catalogue's own search (`templateMatchesQuery`, as the marketing gallery's), across the Pages
  templates; matches are grouped under their group, each once, in rail order. Escape clears a search first; with
  nothing to clear it closes the start, as its × does.
- **A title match leads.** A template whose name begins with what was typed (case, punctuation and hyphens ignored,
  as the search's own) is listed first, under **Best Match**, and not again under its group: an exact name before a
  longer one, then in the order the groups list them. With no name beginning so, there is no Best Match and the
  groups lead.
- **The start is the whole catalogue.** It holds every listed Pages template; there is no bigger picker behind it.
- **Picking a category** opens it at the top of its cards, never part way down the last one's.
- **Keyboard:** the search is focused on a fine pointer; Up and Down move along the rail, choosing as they go. Down
  in the search box moves to the first card it found. Among the cards the arrow keys move between them: Left and Right
  to the card before and after (across a section's end into the next), Up and Down to the nearest card in the row
  above and below; Up from the first row goes back to the search box while there is a search. Home and End reach the
  first and last card.
- **Undo and redo reach the editor through an empty search.** An undo that takes a tab back to empty (a template
  picked, then undone) brings the start back with its search focused, where Cmd/Ctrl+Z and redo were the text box's
  own and did nothing, so the template could not be redone from the keyboard. While the search is empty those chords
  are the editor's (`data-editor-history` on the box, `passesHistoryChords` in `../packages/workbench/src/lib/typing-target.ts`); once something
  is typed in it they undo the typing, as in any text box.
  A **paste** of canvas content reaches the editor the same way: elements copied from another tab (or an image)
  pasted on a new tab land on the canvas, closing the start, rather than their JSON landing in the search. Pasted
  text still searches.

### Recommended and groups

Recommended is the Popular shelf (`popularKindsFor`, the picks the marketing gallery leads with), **its blank
first**. The groups (`components/start/start-template-items.ts`), by what each makes: **Logos**, **Photos** and
**Wireframes**. Each leads with its start of that page kind (Blank Logo, Photo Edit, and the five blank wireframes),
one empty page of the kind meant.

A template in none of the groups is placed in the last group, so every listed template is reachable. Blank
Illustration is not offered: closing the panel leaves the same empty tab.

## When it shows

`templateStartMode` (`components/start/template-start-mode.ts`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside zen and an embed, with no draw tool armed.
- While the tab is empty: no elements, and its one page still has no kind.

While one of the palette's popovers is open (a category's flyout, More or Search), the start **steps aside**: it
stays mounted, so its search, its group and its scroll are kept, but is hidden, and the tiles hang over a clear
canvas. Closing the popover brings it back as it was; using a tile closes the popover, and the content it lands
hides the start for good. The palette publishes the state in `../packages/workbench/src/lib/palette-popover-open.ts`, and `StartPanel` hides
its own root. Never a wrapper around it: the start's View Transition pictures that root, and a `display: contents`
wrapper has no box to picture.

A **Participant** or **Viewer** never sees a start: they keep the empty-canvas card ([New design
route](new-design-route.md) "The empty-canvas hint"), which tells a Viewer the owner can build it out and points a
Participant at what they may add.

A new tab opens on its start (`newTabOpening` in `apps/live/lib/new-tab-seed.ts`).

An **explicit blank** opens with its start already closed (`closeStartForBlank`): a design made by Start Blank's
`/new?blank=1`, a blank's `/new?template=` link, or the public sites' Start Blank (`/new?start=blank`).

## Bringing it back

The × starts from a blank canvas: the start stays closed on that tab, for this person in this browser
(`empty-card-dismissed.ts`, `startClosedKey`). On a phone, dragging the sheet's grab handle down closes it too.

While a closed start's tab is still empty, the **palette tray** (the strip that hangs from the palette, [Toolbar
layout](toolbar-layout.md)) reads "Tab 1 is empty" with **Show Templates**, which opens the start again
(`StartAgainTray`). It goes with the emptiness: the first element ends it. It steps aside while an armed tool's
message is up (its Cancel, a modifier hint), as that takes the same place and says what the next click does. The
closed list is shared state: the panel and the tray read the same key and follow each other as it changes.

## The first page

The tab's first page is drawn only once the start is done: while Start Making Pages is open there is no page behind
it (`EditorCanvasHost` passes no pages), so nothing waits under the panel. Picking a template lands its pages;
closing the panel shows the first page with its own **What Is This Page For?** ([Pages](pages-mode.md)). A blank of
a page kind (Blank Logo, a blank wireframe) lands one page of that kind, already chosen, so it asks nothing and the
start does not come back over it.

**The last page can be deleted.** Deleting it clears the tab, its pages and its elements, as one edit that Undo puts back, and brings Start Making Pages back even if it was closed. The agents'
page edits keep their own rule (`pageRemoved` refuses the last page, `last_page`).

## Default folders

A template picked here on a design `/new` just made goes to that template's default folder, unless the design
was made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default
folders](../013-workspace/default-folders.md) "A template picked after creation"). The move loads only at the pick
(`useTemplatePickMove`, a dynamic import of `move-on-template-pick.ts`).

## The tour waits

The Pages tour never runs over a start: while one is on screen the tour is not on the footer's Start Tour button, and
it comes onto the button once a template is picked or the start closed (`start-panel-open.ts`, `useStartPanelOpen`).
The element tours wait the same way.

## Search handed over

A `/new?q=<words>` link (the marketing site's **Build yours**, a gallery search) makes its words the search of the
new design's start, so the templates it meant are the ones shown. They are kept for the browser tab only and read
once (`start-query.ts`).

## Where it is saved

Under the choices, a quiet strip holds the **Sync Design to Server** switch: where this design is saved, with a line that
says what that means, and the switch to move it while it is still empty
([Save Locations → On the start screen](../006-design/save-locations.md#on-the-start-screen)).
It shows only on a fresh design that is the reader's alone; anywhere else the strip is not drawn. The panel draws it
through its `footer`, in the panel's own colours.

## Look

- **The tab's colours.** The panel's paper is the tab's canvas colour, its accent (the chosen category, the focus
  ring, a card's hover) the theme's stroke and its ink the theme's text, kept readable on the paper
  (`start-palette.ts`, `useStartPalette`). A theme with no colours of its own (Default) leaves the app's light or dark
  look, its accent the app's brand colour (`BRAND_APPS` in `../packages/brand/src/apps.ts`). The Pages tour wears the same palette.
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced
  motion), and its cards and rail cascade in after it (`lvd-cascade`).
- **On a phone** the panel is a sheet risen from the bottom (`animate-sheet-up`), full width below the top bar,
  standing on the tab bar, with the grab handle every phone sheet has. The tab bar stays in reach, so the design's
  other tabs and the tab's menu are never hidden behind the start. Where the bar stands is measured, as the toast
  stack measures its floor (`useChromeFloor`).
- **On a short window** (under 500px tall, whatever the pointer: a phone held sideways, or a laptop zoomed to 200%,
  720×450) the panel clears only the palette strip's height (`pt-16`) and lies over the bottom cluster (the overlay
  layer), standing on the tab bar while it shows. With the desktop clearances (8.5rem above, 7rem below) a 450px
  window left the cards 96px, less than one card.

## Telemetry

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`.

## Tests

- `components/start/start-template-items.test.ts`: Recommended, groups and search, and every listed template
  reachable from the start.
- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `../packages/workbench/src/components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `../packages/workbench/src/components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/template-start-mode.test.ts`: when the start shows.
- `components/start/StartFromTemplates.test.tsx`: the title, choosing, the close, scroll to top.
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `components/start/StartAgainTray.test.tsx`, `../packages/workbench/src/components/canvas/empty-card-dismissed.test.ts` (bringing the start
  back), `hooks/editor/page-edits.test.ts` (the last page).
