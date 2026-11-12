# Template start: Start Making Pages

An empty tab starts from a choice, not a blank page and a modal. Every new tab offers **Start Making Pages**: a wide
panel in the middle of the canvas, its rail of groups beside a grid of the Pages templates, so the templates sit
where the work begins instead of in a step before it. The New Document route asks for nothing first
([New document route](new-document-route.md)), and the document opens on its tab's start.

## The panel

`StartPanel` (`apps/editor/components/start/StartPanel.tsx`, this app's binding of the panel every editor shares, `../packages/workbench/src/components/start/StartPanel.tsx`) draws the start; the start says what its groups and cards
are, the panel draws them.

- **Header:** over the app's own band ([The header band](#the-header-band)), a title mark, then the title ("Start Making Pages"), one line under it, the search box, and in the top right corner the
  **Help** link. There is no **Close** (see [A choice first](#a-choice-first)). On a phone the search takes its own
  row under the title, the help staying beside the title, and the sheet has no grab handle to drag it away.
- **Rail:** **Blank Pages**, then the groups, each with its glyph and count, Blank Pages chosen as the start opens.
  Group names are a word each (the catalogue's short labels), so each sits on one line. The chosen group's count sits on a pill tinted with the accent, in the panel's ink: the accent on its
  own tint read 3.6:1 in light, under WCAG AA's 4.5:1.
- **Connect File** ([Connected tabs](../../../../liveworkspace/docs/specs/004-index/connected-tabs.md#connecting)):
  the rail's last entry, stuck to its very bottom under a hairline (the shared `ConnectRailEntry`), every app's
  logo fanned where its icon goes (its own too), its name on one line; on a phone the last chip. Chosen, the content area shows the shared Connect list (Recent
  across every app, the role, both ways) in the panel's colours, its code loaded only then (`useConnectStart`); with nothing recent, its Open Explorer goes to the full-page Explorer. A
  press connects the file: the document gains the connected tab, which takes the place of this empty tab unless it is
  the document's only tab, and opens ready. Offered only to a signed-in Editor of a document on the server, outside a
  tab-scoped link, an embed and a workbench. A connected tab never shows this start.
- **Cards:** each template's preview on a soft plate, its name and its description in full (a Community tile, after
  a group's templates, the same with a **Community** badge and its credit, [From the
  Community](#from-the-community)). Choosing a card lands
  the template on the tab at once (`chooseTemplate`), painted in the **tab's theme**: the panel picks no theme, so
  the scaffold takes the colours the tab already wears (its own theme, or the one a new tab inherited from the tab it
  was added beside) rather than the template's built-in ones. The tab's backdrop is left as it is.
- **Search:** the catalogue's own search (`templateMatchesQuery`, as the marketing gallery's), across the Pages
  templates; matches are grouped under their group, each once, in rail order. Escape clears a search; with nothing
  to clear it does nothing.
- **A title match leads.** A template whose name begins with what was typed (case, punctuation and hyphens ignored,
  as the search's own) is listed first, under **Best Match**, and not again under its group: an exact name before a
  longer one, then in the order the groups list them. With no name beginning so, there is no Best Match and the
  groups lead.
- **The Community joins the search.** A Community tile ([From the Community](#from-the-community)) matches when every
  word of the search is in its title, listed after its group's matching templates, and may lead under Best Match as
  a template would.
- **The start is the whole catalogue.** It holds every listed Pages template; there is no bigger picker behind it.
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
  A **paste** of canvas content reaches the editor the same way: elements copied from another tab (or an image)
  pasted on a new tab land on the canvas, closing the start, rather than their JSON landing in the search. Pasted
  text still searches.

### Groups

**Blank Pages** leads, chosen as the start opens: Blank Slide Deck, Blank Article, Blank Infographic and Blank
Flashcards, one empty page of the kind meant. Then one group per catalogue category, in the same alphabetical order
and with the same names as every other picker
([Template categories](../008-canvas/canvas-and-palette.md#template-categories)), each template under its primary
category (`components/start/start-template-items.ts` derives them, so a new template or category needs no change
there).

Every listed template is in exactly one group, so every one is reachable. Blank Illustration is not offered: Blank
Infographic is the same empty page, already chosen.

**No Recommended.** The start once led with a Recommended group (the template step's short Popular list, two of its
picks swapped for blanks of a page kind). Retired 2026-11-04: each of its picks already sat in Blank Pages or in its
own group, so it was a second place to look rather than a quicker start. The marketing gallery's Popular shelf
(`POPULAR_TEMPLATE_KINDS`) is its own and stays.

### From the Community

After each group's templates come up to three of people's Community posts in that category, the month's most liked
(at least five likes in 30 days), as the platform spec says ([007-community "Start
With"](../../../../liveworkspace/docs/specs/007-community/community.md#start-with)). The groups are the Community's
categories (the Community's categories are the template categories, [Community](../025-community/community.md)
"Categories"), so a post sits beside the templates it was filed with. Each tile is the post's live card image, its
title, the first line of its description and its credit ("By Ada", or "Shared anonymously") in the panel's muted
ink, badged **Community**; a screen reader hears "<title> from the Community". Blank Pages keeps to its blanks, and
the rail's counts are the templates' alone, so they do not change as tiles arrive. A category with no listed
template has no group on the rail, so no tiles either, and Something Else (`other`) is never one.

The posts load once a session, the first time a start opens (`useCommunityStart` from
`@liveworkspace/community-ui/start`, never on the editor's load, never for a start closed by an explicit blank), and
arrive after the panel has painted: they join the end of each group's grid, below what is drawn, so nothing moves.
With the Community switched off, unreachable or empty, the start is its templates alone and says nothing. Choosing a
tile does not touch the tab: it makes the person's own copy of the post's document through its community link
(`/document/shared?s=<code>&copy=1`, the Community page's Make a Copy), which counts as a copy and opens the copy.

Only an **Editor** ever sees a start ([When it shows](#when-it-shows)), so only an Editor sees the tiles; a
Participant or Viewer sees none. The copy is the person's own new document, whatever their role on this one.

## A choice first

A new document or tab holds **no page until something is chosen**. The start cannot be dismissed: it has no ×,
Escape does nothing once the search is clear, a press outside it does nothing, and on a phone there is no grab handle
to drag it down. Nothing waits under it as a page. Blank Pages is the way to start from nothing: each of its blanks
lands one empty page of its kind, already chosen.

## When it shows

`showsTemplateStart` (`components/start/template-start-mode.ts`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside zen and an embed, with no draw tool armed.
- While the tab is empty: no elements, and its one page still has no kind.

While one of the palette's popovers is open (a category's flyout or Search), the start **steps aside**: it
stays mounted, so its search, its group and its scroll are kept, but is hidden, and the tiles hang over a clear
canvas. Closing the popover brings it back as it was; using a tile closes the popover, and the content it lands
hides the start for good. The palette publishes the state in `../packages/workbench/src/lib/palette-popover-open.ts`, and `StartPanel` hides
its own root. Never a wrapper around it: the start's View Transition pictures that root, and a `display: contents`
wrapper has no box to picture.

A **Participant** or **Viewer** never sees a start: they see the empty page ([New document
route](new-document-route.md) "The empty-canvas hint").

A new tab opens on its start: it is empty, carrying only the theme and canvas styling of the tab it was added from (`newTabSeed` in `apps/editor/lib/new-tab-seed.ts`).

An **explicit blank** opens with its start already closed (`closeStartForBlank`): a document made by Start Blank's
`/new?blank=1`, a blank's `/new?template=` link, or the public sites' Start Blank (`/new?start=blank`).

## Bringing it back

Only an **explicit blank** (above) opens with the start closed, keyed per tab for this person in this browser by
`startClosedKey` (`../packages/workbench/src/components/canvas/empty-card-dismissed.ts`). Its one page asks **What Is
This Page For?** ([Pages](pages-mode.md)), which has no way out either, and while the tab is still empty the
**palette tray** (the strip that hangs from the palette, [Toolbar layout](toolbar-layout.md)) reads "Tab 1 is
empty" with **Show Templates**, which opens the start again (`StartAgainTray`). It goes with the emptiness: the first
element ends it. It steps aside while an armed tool's message is up (its Cancel, a modifier hint), as that takes the
same place and says what the next click does. The closed list is shared state: the panel and the tray read the same
key and follow each other as it changes.

## The first page

The tab's first page is drawn only once the start is done: while Start Making Pages is open there is no page behind
it (`EditorCanvasHost` passes no pages), so nothing waits under the panel. That holds from the tab's first frame:
the canvas reads the same rule the panel does (`useTemplateStartShown`), not the panel's mount, so a new tab never
flashes an empty page while the panel's code is still loading. A start closed for the tab (an explicit blank, "Bringing
it back") is not open: the canvas reads `useTemplateStartOpen`, the rule and the tab's closed key together, so the
explicit blank's one page is drawn at once, asking What Is This Page For? Picking a template lands its pages. A blank of
a page kind (Blank Slide Deck, Blank Article, Blank Infographic) lands one page of that kind, already
chosen, so it asks nothing and the start does not come back over it. Though it brings no elements, the view frames
its page as it lands, as any template's first page is framed ([Pages mode](pages-mode.md) "Centred in the viewport"):
left framed on the A4 page it replaced, a slide on a phone opened wider than the screen (Work Tracker #666).

**The last page can be deleted.** Deleting it (or the last article) clears the tab, its pages, its writing and its
elements, as one edit that Undo puts back, and brings Start Making Pages back, even on an explicit blank. The agents'
page edits keep their own rule (`pageRemoved` refuses the last page, `last_page`).

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the document
was made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default
folders](../013-workspace/default-folders.md) "A template picked after creation"). The move loads only at the pick
(`useTemplatePickMove`, with the platform's `moveOnTemplatePick` from `@liveworkspace/explorer`): only a pick on a
noted document asks the index anything.

## The tour waits

The Pages tour never runs over a start: while one is on screen the tour is not on the footer's Start Tour button, and
it comes onto the button once a template is picked or the start closed (`start-panel-open.ts`, `useStartPanelOpen`).
The element tours wait the same way.

## Search handed over

A `/new?q=<words>` link (the marketing site's **Build yours**, a gallery search) makes its words the search of the
new document's start, so the templates it meant are the ones shown. They are kept for the browser tab only and read
once (`start-query.ts`).

## Where it is saved

Under the choices, a quiet strip holds the **Sync Document to Server** switch: where this document is saved, with a line that
says what that means, and the switch to move it while it is still empty
([Save Locations → On the start screen](../006-document/save-locations.md#on-the-start-screen)).
It shows only on a fresh document that is the reader's alone; anywhere else the strip is not drawn. The panel draws it
through its `footer`, in the panel's own colours.

## The header band

The header is drawn over the app's own band: its Explorer hero backdrop ([The start header wears the same
theme](../../../../liveworkspace/docs/specs/004-index/one-explorer.md#the-start-header-wears-the-same-theme)), redrawn
at a header's height by the shared `StartHeaderBand`
(`../packages/workbench/src/components/start/StartHeaderBand.tsx`), which the panel asks for with
`useStartHeaderTheme('livedocuments', palette)`. Which backdrop is whose, the title's face and the textures' measures
are the hero's own theme (`@liveworkspace/explorer/hero-theme`), so the start and the Explorer read as one app.

- **The motif.** **Typesetter**: an 8px baseline grid, a margin rule of two hairlines down the left edge, the title
  set in the system's serif (no font fetched), and from `xl` a large pilcrow in the gap. The title mark is a pilcrow.
- **In the panel's colours.** The band paints in the start palette, never the brand ramp: each of its colours is the
  palette's accent mixed into its card (`start-band-colours.ts`), so it follows the app's light or dark look; a tab's
  theme never reaches it. The ground leans back until the title and the line read at WCAG AA
  (4.5:1) on every patch they can sit over (the paper and its two deeper shades); the line keeps the palette's muted
  where it reads there, else leans toward the ink. The help link keeps its own ink.
- **The title.** A title mark leads it: a 36px tile (32px on a phone) in the band's deeper shade, holding the motif as
  one glyph in the accent (`StartTitleMark`). The title is set in the hero's face at 20px (18px on a phone): the
  system's serif, semibold (`startHeadingFace`).
- **Its height.** From `sm` the header stands 100px tall (owner, 2026-11-10), its row centred in it, so the band has
  room to show its texture and pieces; on a phone it stays compact (below).
- **Where the pieces show.** The texture and the corner pieces at every size; the gap piece only from `xl`, where the
  panel is at its widest; there the line wraps at 30rem, two lines inside the 100px, so it ends short of the piece
  and the two never meet.
- **The search** keeps its own paper and border over the band, lifted by a small shadow, so it still reads as the
  field.
- **On a phone** the header stays as compact as before: the title row with its mark, then the search.
- **Hidden and cheap.** The band is `aria-hidden` and takes no pointer events. It is CSS gradients and a few small
  inline SVGs: no image, font, filter or blur, nothing fetched, painted once. No motion.

## Look

- **The app's colours, never the tab's.** The panel wears the app's own light or dark look (Appearance, not the
  tab's paper), its accent the app's brand colour, whatever theme the tab wears (owner, 2026-11-10: a tab's theme must
  never reach the start, so each app's themed header band stays its own). `useStartPalette` reads only Appearance.
  The tours wear the same palette.
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced
  motion), and its cards and rail cascade in after it (`lvd-cascade`).
- **On a phone** the panel is a sheet risen from the bottom (`animate-sheet-up`), full width below the top bar,
  standing on the tab bar, with the grab handle every phone sheet has. The tab bar stays in reach, so the document's
  other tabs and the tab's menu are never hidden behind the start. Where the bar stands is measured, as the toast
  stack measures its floor (`useChromeFloor`).
- **On a short window** (under 500px tall, whatever the pointer: a phone held sideways, or a laptop zoomed to 200%,
  720×450) the panel clears only the palette strip's height (`pt-16`) and lies over the bottom cluster (the overlay
  layer), standing on the tab bar while it shows. With the desktop clearances (8.5rem above, 7rem below) a 450px
  window left the cards 96px, less than one card.

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
- `components/start/start-template-items.test.ts`: Blank Pages first, groups and search, and every listed template
  reachable from the start.
- `components/start/StartPanel.test.tsx`: Down from the search, Best Match leading, the arrow keys among the cards.
- `../packages/workbench/src/components/start/best-match.test.ts`: which names lead, exact first, lifted out of their groups once.
- `../packages/workbench/src/components/start/start-card-keys.test.ts`: where each arrow, Home and End go in a grid of cards.
- `components/start/template-start-mode.test.ts`: when the start shows.
- `components/start/StartFromTemplates.test.tsx`: the title, choosing, the close, scroll to top; from the Community:
  tiles after a group's templates with their badge, none in Blank Pages, the rail's counts unchanged, search,
  choosing one (the telemetry and the copy link), nothing while closed or switched off.
- `../packages/community-ui/src/start/start-tiles.test.tsx`: a group's Community cards, a search with them joined
  in, and the badge's colours reading at AA in light and dark (shared by every app's start).
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `components/start/StartAgainTray.test.tsx`, `../packages/workbench/src/components/canvas/empty-card-dismissed.test.ts` (bringing the start
  back), `hooks/editor/page-edits.test.ts` (the last page).
