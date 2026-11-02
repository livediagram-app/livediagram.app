# Template start: Start a Workshop

An empty tab starts from a choice, not a blank page and a modal: **Start a Workshop**, a wide panel in the middle of
the canvas, its rail of groups beside a grid of the templates, so the templates sit where the work begins instead of in
a step before it. livediagram's Start Diagramming and Start Drawing went with Diagram and Draw
([Editor modes](editor-modes.md)).

## The panel

One shared panel, `StartPanel` (`apps/editor/components/start/StartPanel.tsx`), draws the start; the start says what its groups and cards are, the panel
draws them.

- **Header:** the title ("Start a Workshop"), one line under it, the search box, and in the top right corner the
  **Help** link and (where the start can be closed) **Close** (×). On a phone the search takes its own row under the
  title, the help and × staying beside the title.
- **Rail:** **Recommended** and the groups, each with its glyph and count; long names wrap beside the glyph on a wide rail. The chosen group's
  count sits on a pill tinted with the accent, in the panel's ink: the accent on its own tint fell to 4.2:1 in dark
  and 2.7:1 in light. The chosen group's name is the accent leaned toward the ink just far enough to read at 4.5:1 on
  its tint and its hover's (`chosenLabel`): light's brand accent on its tint read 3.3:1, so light wears a darker
  accent there (5.2:1); dark's accent already reads (6.4:1) and is kept.
- **Cards:** each template's preview on a soft plate, its name and its description in full. Choosing a card lands
  the template on the tab at once (`chooseTemplate`), painted in the **tab's theme**: the
  panel picks no theme, so the scaffold takes the colours the tab already wears (its own theme, or the one a new
  tab inherited from the tab it was added beside) rather than the template's built-in ones. The tab's backdrop is
  left as it is.
- **Search:** the catalogue's own search (`templateMatchesQuery`, as the marketing gallery's),
  across the templates; matches are grouped under their group, each once, in rail order. Escape clears a search
  first; with nothing to clear it closes a start that can close, as its × does.
- **A title match leads.** A template whose name begins with what was typed (case, punctuation and hyphens ignored,
  as the search's own) is listed first, under **Best Match**, and not again under its group: an exact name before a
  longer one, then in the order the groups list them. Typing "retro" leads with Retrospective, though a template
  matching through its search words may come earlier in the rail. With no name beginning so,
  there is no Best Match and the groups lead as before.
- **There is no way out to a bigger picker.** The start holds every listed template; it is the whole catalogue. There is no modal of every template ([New document route](new-document-route.md)).
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
  A **paste** of canvas content reaches the editor the same way: elements copied from another tab (or an image, or an
  Excalidraw scene) pasted on a new tab land on the canvas, closing the start, rather than their JSON landing in the
  search. Pasted text still searches.

### Recommended and groups

Recommended is the Popular shelf (`popularKindsFor`, the picks the marketing gallery leads with), **the blank
first**. The groups (`components/start/start-template-items.ts`, `TEMPLATE_STARTS`) are the catalogue's categories
([Canvas and palette](../008-canvas/canvas-and-palette.md) "Template categories"): in the catalogue's order,
alphabetical by label, each holding the templates listed in it (primary or cross-listed). A new template joins the
rail with no change here.

Every listed template has a primary category, so every one is reachable. The blank appears only in
Recommended. Choosing the blank closes the panel, as the × does, since it leaves the tab empty.

## When it shows

`templateStartMode` (`components/start/template-start-mode.ts`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside zen and an embed, with
  no draw tool armed.
- While the tab is empty: no elements.

While one of the palette's popovers is open (a category's flyout, More or Search), the start **steps aside**: it
stays mounted, so its search, its group and its scroll are kept, but is hidden, and the tiles hang over a clear
canvas. Closing the popover brings it back as it was; using a tile closes the popover, and the content it lands
hides the start for good. The palette publishes the state in `../packages/workbench/src/lib/palette-popover-open.ts`, and `StartPanel` hides its own root, Never a wrapper around it.

A **Participant** or **Viewer** never sees a start: they keep the empty-canvas card ([New document
route](new-document-route.md) "The empty-canvas hint"), which tells a Viewer the owner can build it out and points a
Participant at what they may add.

A new tab opens on the start (`newTabOpening` in `apps/editor/lib/new-tab-seed.ts`).

An **explicit blank** opens with its start already closed (`closeStartForBlank`): a document made by Skip, Start
Blank's `/new?blank=1`, a blank's `/new?template=` link, or the public sites' Start Blank (`/new?start=blank`,
[New document route](new-document-route.md)).

## Bringing it back

The × starts from a blank canvas: the start stays closed on that tab, for this person in this browser
(`empty-card-dismissed.ts`, `startClosedKey`). On a phone, dragging the sheet's grab handle down
closes it too.

While a closed start's tab is still empty, the **palette tray** (the strip that hangs from the palette, as the mode
banners do, [Toolbar layout](toolbar-layout.md)) reads "Tab 1 is empty" with **Show Templates**, which opens the
start again (`StartAgainTray`). It goes with the emptiness: the first element ends it. It steps aside while a mode's message is up (an armed tool's Cancel, a modifier hint), as that takes the same place and says what the next click does. The closed list is shared state: the panel and the
tray read the same key and follow each other as it changes.

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the document
was made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default folders](../013-workspace/default-folders.md) "A template
picked after creation"). The move is `useTemplatePickMove` (`apps/editor/components/start/useTemplatePickMove.ts`).

## The tours wait

A tour never lands over a start: while one is on screen the Workshop and Avatar tours are not on
offer, so the footer's Start Tour button does not show them, and they come onto it once a template is picked or the
start closed (`start-panel-open.ts`, `useStartPanelOpen`).

## Search handed over

A `/new?q=<words>` link (the marketing site's **Build yours**, a gallery search) makes a document whose words become
the search of its start, so the templates it meant are the ones shown.
They are kept for the browser tab only and read once (`start-query.ts`).

## Where it is saved

Under the choices, a quiet strip holds the **Sync Canvas to Server** switch: where this canvas is saved, with a line that
says what that means, and the switch to move it while it is still empty
([Save Locations → On the start screen](../006-document/save-locations.md#on-the-start-screen)).
It shows only on a fresh canvas that is the reader's alone; anywhere else the strip is not drawn. The panel draws it
through its `footer`, in the panel's own colours.

## Look

- **The tab's colours.** The panel's paper is the tab's canvas colour, its accent (the chosen category, the focus
  ring, a card's hover) the theme's stroke and its ink the theme's text, through `startPalette`, which keeps the ink readable on the paper (`start-palette.ts`, `useStartPalette`). A theme with no colours
  of its own (Default) leaves the app's light or dark look, its accent the app's brand colour (`BRAND_APPS` in
  `../packages/brand/src/apps.ts`). The tours wear the same palette
  ([Tours](editor-tour.md#look)).
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced
  motion), and its cards and rail cascade in after it (`lvd-cascade`).
- **On a phone** the panel is a sheet risen from the bottom (`animate-sheet-up`), full width below the top bar,
  standing on the tab bar, with the grab handle every phone sheet has. The tab bar stays in reach. Where the bar stands is measured, as the
  toast stack measures its floor (`useChromeFloor`), so a short window stands on it too while it shows and keeps
  the room when the bars are folded away.
- **On a short window** (under 500px tall, whatever the pointer: a phone held sideways, or a laptop zoomed to 200%,
  720×450) the panel clears only the palette strip's height (`pt-16`) and lies over the bottom cluster (the overlay
  layer), standing on the tab bar while it shows, as on a sideways phone. With the desktop clearances (8.5rem above, 7rem below) a 450px window left
  the cards 96px, less than one card, so zooming the browser made the start unusable.

## Telemetry

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`.

## Tests

- `components/start/start-template-items.test.ts`: Recommended, groups and search, and every listed template
  reachable from the start.
- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `../packages/workbench/src/components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `../packages/workbench/src/components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/template-start-mode.test.ts`: when a start shows.
- `components/start/StartFromTemplates.test.tsx`: the title, choosing, the blank closing, the close, scroll to top.
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `components/start/StartAgainTray.test.tsx`, `../packages/workbench/src/components/canvas/empty-card-dismissed.test.ts` (bringing a start back).
