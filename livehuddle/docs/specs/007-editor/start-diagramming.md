# Template start: Start a Space

An empty tab starts from a choice, not a blank page and a modal: **Start a Space**, a wide panel in the middle of
the canvas, its rail of groups beside a grid of the templates, so the templates sit where the work begins instead of in
a step before it. livediagram's Start Diagramming and Start Drawing went with Diagram and Draw
([Editor modes](editor-modes.md)).

## The panel

One shared panel, `StartPanel` (`apps/editor/components/start/StartPanel.tsx`, this app's binding of the panel every editor shares, `../packages/workbench/src/components/start/StartPanel.tsx`), draws the start; the start says what its groups and cards are, the panel
draws them.

- **Header:** over the app's own band ([The header band](#the-header-band)), a title mark, then the title ("Start a Space"), one line under it ("Walk into an office, a hall, a bar or a garden.
  Close this to start from a blank space."), the search box, and in the top right corner the
  **Help** link and (where the start can be closed) **Close** (×). On a phone the search takes its own row under the
  title, the help and × staying beside the title.
- **Rail:** **Recommended** first, then the other groups (Campus, Events, Games Rooms, Homes, Office, Outdoor, Recreation, Venues), each with its glyph and count; long names wrap beside the glyph on a wide rail. The chosen group's
  count sits on a pill tinted with the accent, in the panel's ink: the accent on its own tint fell to 4.2:1 in dark
  and 2.7:1 in light. The chosen group's name is the accent leaned toward the ink just far enough to read at 4.5:1 on
  its tint and its hover's (`chosenLabel`): light's brand accent on its tint read 3.3:1, so light wears a darker
  accent there (5.2:1); dark's accent already reads (6.4:1) and is kept.
- **Connect File** ([Connected tabs](../../../../liveworkspace/docs/specs/004-index/connected-tabs.md#connecting)):
  the rail's last entry, stuck to its very bottom under a hairline (the shared `ConnectRailEntry`), every app's
  logo fanned where its icon goes (its own too), its name on one line; on a phone the last chip. Chosen, the content area shows the shared Connect list (Recent
  across every app, the role, both ways) in the panel's colours, its code loaded only then (`useConnectStart`); with nothing recent, its Open Explorer goes to the full-page Explorer. A
  press connects the file: the space gains the connected tab, which takes the place of this empty tab unless it is
  the space's only tab, and opens ready. Offered only to a signed-in Editor of a space on the server, outside a
  tab-scoped link and an embed.
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
- **The Community joins the search.** A Community tile ([From the Community](#from-the-community)) matches when every
  word of the search is in its title, listed after its group's matching templates, and may lead under Best Match as
  a template would.
- **There is no way out to a bigger picker.** The start holds every listed template; it is the whole catalogue. There is no modal of every template ([New document route](new-document-route.md)).
- **Picking a category** opens it at the top of its cards, never part way down the last one's.
- **Keyboard:** the search is focused on a fine pointer, as the panel opens, unless focus has gone somewhere since: the
  panel's code loads when it is first drawn, so on a busy machine it can arrive after a control was reached or a menu
  opened from the keyboard, and it never takes focus from one. It takes it only from the page itself or the canvas
  (`focusIsFree`, `../packages/workbench/src/lib/focus-is-free.ts`). Up and Down move along the rail, choosing as they go. Down
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

### Recommended leads

The start **leads with Recommended**: it is the rail's first group and the group the start opens on, so the first
thing a new person sees is the quickest ways to meet, the blank first, then the picks most teams start from. The
catalogue's categories follow in its alphabetical order
([Template categories](../008-canvas/canvas-and-palette.md#template-categories)). Every template in a category is a
Space and opens walking once it lands ([Avatar mode](../008-canvas/avatar-mode.md#opening-walking)).

Why: Recommended already holds Spaces to walk into, and it is the one group that crosses categories (an Office
Space and an Events hall side by side) with the blank beside them, so it is the better first answer than one category.

### Recommended and groups

Recommended is the Popular shelf (`popularKindsFor`, the picks the marketing gallery leads with), **the blank
first**, first in the rail. The other groups (`components/start/start-template-items.ts`,
`TEMPLATE_STARTS`) are the catalogue's categories
([Canvas and palette](../008-canvas/canvas-and-palette.md) "Template categories"): in the catalogue's order, each
holding the templates listed in it (primary or cross-listed), alphabetical by label. A new template joins the rail
with no change here.

Every listed template has a primary category, so every one is reachable. The blank appears only in
Recommended. Choosing the blank lands its [Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)
a little below the middle of the view and closes the panel, leaving the view, the selection and the tool in hand as
they were; the × does the same.

### From the Community

After each group's templates come up to three of people's Community posts in that category, the month's most liked
(at least five likes in 30 days), as the platform spec says ([007-community "Start
With"](../../../../liveworkspace/docs/specs/007-community/community.md#start-with)). The groups are the Community's
categories (livehuddle's Community categories are its template categories: Campus, Events, Office, Outdoor and
Recreation), so a post sits beside the templates it was filed with; Something Else has no group in the rail, so its
posts show only in the Community gallery. Each tile is the post's live card image, its title, the first line of its
description and its credit ("By Ada", or "Shared anonymously") in the panel's muted ink, badged **Community**; a
screen reader hears "<title>, from the Community". Recommended keeps to templates, and the rail's counts are the
templates' alone, so they do not change as tiles arrive.

The posts load once a session, the first time a start opens (`useCommunityStart`, never on the editor's load), and
arrive after the panel has painted: they join the end of each group's grid, below what is drawn, so nothing moves.
With the Community switched off, unreachable or empty, the start is its templates alone and says nothing. Choosing a
tile does not touch the tab: it makes the person's own copy of the post's Space through its community link
(`/document/shared?s=<code>&copy=1`, the Community page's Make a Copy), which counts as a copy and opens the copy.

## When it shows

`EditorStartPanels` (`components/start/EditorStartPanels.tsx`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside an embed, with
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

The × starts from a blank space: it lands the Blank Space's Avatar Pad, as choosing the blank does (but counts no
`Template·Used`: a close is not a pick), and the start stays closed on that tab, for this person in this browser
(`empty-card-dismissed.ts`, `startClosedKey`). On a phone, dragging the sheet's grab handle down
closes it too, and so does Escape with nothing to clear; each lands the pad.

While a closed start's tab is still empty (its pad taken away, or a close by someone whose pad never landed), the **palette tray** (the strip that hangs from the palette, as the mode
banners do, [Toolbar layout](toolbar-layout.md)) reads "Tab 1 is empty" with **Show Templates**, which opens the
start again (`StartAgainTray`). It goes with the emptiness: the first element ends it. It steps aside while a mode's message is up (an armed tool's Cancel, a modifier hint), as that takes the same place and says what the next click does. The closed list is shared state: the panel and the
tray read the same key and follow each other as it changes.

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the document
was made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default folders](../013-workspace/default-folders.md) "A template
picked after creation"). The move is `useTemplatePickMove` (`apps/editor/components/start/useTemplatePickMove.ts`).

## The tours wait

A tour never lands over a start: while one is on screen the Workshop tour and Ask Receptionist are not on
offer, so the footer's Start Tour button does not show them, and they come onto it once a template is picked or the
start closed (`start-panel-open.ts`, `useStartPanelOpen`).

Walking waits the same way: while a start is open, Avatar mode cannot be entered and no walking input moves the
character ([Avatar mode](../008-canvas/avatar-mode.md#not-over-a-start)).

## Search handed over

A `/new?q=<words>` link (the marketing site's **Build yours**, a gallery search) makes a document whose words become
the search of its start, so the templates it meant are the ones shown.
They are kept for the browser tab only and read once (`start-query.ts`).

## Where it is saved

Under the choices, a quiet strip holds the **Sync Space to Server** switch: where this canvas is saved, with a line that
says what that means, and the switch to move it while it is still empty
([Save Locations → On the start screen](../006-document/save-locations.md#on-the-start-screen)).
It shows only on a fresh canvas that is the reader's alone; anywhere else the strip is not drawn. The panel draws it
through its `footer`, in the panel's own colours.

## The header band

The header is drawn over the app's own band: its Explorer hero backdrop ([The start header wears the same
theme](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#the-start-header-wears-the-same-theme)), redrawn
at a header's height by the shared `StartHeaderBand`
(`../packages/workbench/src/components/start/StartHeaderBand.tsx`), which the panel asks for with
`useStartHeaderTheme('livehuddle', palette)`. Which backdrop is whose, the title's face and the textures' measures are
the hero's own theme (`@liveworkspace/explorer/hero-theme`), so the start and the Explorer read as one app.

- **The motif.** **Huddle**: voice rings every 14px (half the hero's pitch, to fit), fading into the paper as they
  spread, from the corner where the help and × sit; from `xl` a round table stands in the gap, seen from above, five
  of its six seats taken, and the rings spread from it instead, the speaker's own ring spreading three times as the
  panel arrives (the empty states' ring). The title mark is a table with four seats round it, the one speaking full.
- **In the panel's colours.** The band paints in the start palette, never the brand ramp: each of its colours is the
  palette's accent mixed into its card (`start-band-colours.ts`), so it follows the app's light or dark look; a tab's
  theme never reaches it. The ground leans back until the title and the line read at WCAG AA
  (4.5:1) on every patch they can sit over (the paper and its two deeper shades); the line keeps the palette's muted
  where it reads there, else leans toward the ink. The × takes the band's muted.
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

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`. A Community tile chosen fires
`Community · Copied · StartWith`.

## Tests

- `../packages/workbench/src/components/start/start-band-colours.test.ts`: the band's title and line read at AA on
  every ground, light, dark and themed; a palette that is not plain hex keeps a flat band.
- `../packages/workbench/src/components/start/StartHeaderBand.test.tsx`: each app's band and title mark, hidden from
  screen readers; the gap piece only from `xl`; the band under the grab handle on a phone.
- `../packages/explorer/src/hero/hero-theme.test.ts`: every app its own backdrop, none the All Apps dots; only the
  Typesetter in serif.
- `components/start/start-template-items.test.ts`: Recommended, groups and search, and every listed template
  reachable from the start.
- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `../packages/workbench/src/components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `../packages/workbench/src/components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/StartFromTemplates.test.tsx`: the title, choosing, the blank closing, the close, scroll to top;
  from the Community: tiles after a group's templates with their badge, none in Recommended, the rail's counts
  unchanged, search, choosing one (the telemetry and the copy link), nothing while closed or switched off.
- `../packages/community-ui/src/start/start-tiles.test.tsx`: a group's Community cards, a search with them joined
  in, and the badge's colours reading at AA in light and dark (shared by every app's start).
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `packages/avatar/src/walk-guard.test.ts`, `components/palette/EditWalkToggle.test.tsx`: no walking over a start.
- `../packages/workbench/src/components/canvas/empty-card-dismissed.test.ts` (bringing a start back).
