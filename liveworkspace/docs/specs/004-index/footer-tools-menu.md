# The footer's Tools menu

Every editor's footer cluster (`ChromeControls`, each product's [Editor app](../../../../livediagram/docs/specs/007-editor/editor-app.md)
"Tab bar") used to carry a button for each tool that works on the whole item: **Automations** (liveplanner),
**Snapshots** (every app), **History** (livedocuments) and **Search** (every app). Each was a word and an icon in a bar that is mostly
about the tabs, so the cluster grew noisy as tools arrived. They now sit behind one **Tools** button, so the bar holds
Settings, the appearance and one way into the rest.

## Where it sits

- **Tools** leads the cluster, before Settings. The **Start Tour** button, when a tour is on offer, comes before it.
- Its glyph is a toolbox. Labelled **Tools** from `sm` up like its neighbours (unless **Button Labels** is off),
  icon-only on a phone (a 40 px target, named "Tools"). It has no hover card: its label says what it is, and the
  popover says the rest.
- It is drawn only while it holds at least one tool. Someone who may use none of them (a Viewer, a Community visitor,
  a workbench frame, an item kept **Offline** without Automations) sees no Tools button at all, never an empty popover.
- The Explorer's bottom bar has it too, holding Search alone.

## What it holds

A popover, not a plain dropdown: a rounded panel with a pointer aimed at the button, 480px wide (never past the window's edges), opening above it
(below when there is no room above), its right edge on the button's. It wears the [dialog hero
header](./dialog-hero-header.md) (art `tools`: the tools hung on a pegboard), titled **Tools** with the line "Powerful tools to enhance
your experience." (the title and line stop 7.5rem from the right, clear of the art), its close in the panel's top right corner. Under it, one **row** per tool the app offers and the person may use, in
this order: the tool's glyph on a 40px plate in the hero's tokens (its soft, deepening to its wash under the pointer),
its name, one line on what it does (never wrapping: kept short enough for one line, truncated past it), its count where it has one, and a chevron that steps right on hover. A row takes
the band's paper under the pointer, so the list reads as the header's.

The rows are grouped under small headings, in this order, a heading drawn only when its group holds a row: **Find**
(Search, then Ask AI), **Automate** (Automations, then liveplanner's Email to Board), **Collaborate** (Walkthroughs, and
liveplanner's Subscribe to Calendar), **Versioning** (History alone: Snapshots and livedocuments' Version History live
inside it). Clear Example Content is not in Tools (owner, 2026-11-17): the palette's example tray offers it, and needs nothing more. Each
group is a labelled group for screen readers; the arrow keys walk the rows straight through the groups.

| Row              | App                                                 | Drawn when                                                                                                                                                               | Opens, inside Tools                                      |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **History**      | every app                                           | signed in, the open item not shared by link (no longer on the item's ⋯ menu inside an editor); or the person may take snapshots; or livedocuments offers Version History | the History below, with Snapshots in it                  |
| **Search**       | every app                                           | the host offers search (the editor and the Explorer's bar)                                                                                                               | the Search dialog (closes Tools)                         |
| **Ask AI**       | every app but liveknowledge                         | an item is open (signed out, badged Sign In)                                                                                                                             | [Ask AI](../019-ask/ask.md), kept open beside the canvas |
| **Automations**  | liveplanner                                         | as its button was ([Automations](../../../../liveplanner/docs/specs/026-plan/automations.md) "The footer button")                                                        | the Automations screen, widened                          |
| **Walkthroughs** | livediagram, livedocuments, liveplanner, livedesign | walkthroughs fit and there is one to play or the person may record ([Walkthroughs](../../../../livediagram/docs/specs/012-collaboration/walkthroughs.md) "In Tools")     | the list to play, and Record Walkthrough                 |

- **Automations** keeps its count: the rules that are on, at the row's end (none at 0), amber when a rule
  paused itself. A paused rule also puts a small amber dot on the Tools button, so the warning the button carried
  is still seen with the menu shut, and the button's name says so ("Tools, a rule is paused").
- **Walkthroughs** keeps the count of recorded walkthroughs at the row's end (none at 0). It never puts a dot on Tools:
  a walkthrough is there to play when wanted, not news.
- Choosing a row opens its tool **inside Tools** (below), sending the same telemetry the button did. **Search** and
  liveplanner's **Automations** are the exceptions (owner, 2026-11-17): each closes Tools and opens its own modal, Search
  the universal search panel and Automations its full-size screen of rules, as before. Their rows read **Search…** and **Automations…**,
  the ellipsis saying they open outside Tools.

## History, with Snapshots in it

Owner, 2026-11-17: merge Snapshots into History, so Versioning has one row. **History** opens inside Tools and holds
what used to be three tools:

- **The timeline**, for someone signed in on an item not shared by link: who changed what, and when, as before.
- **Snapshots**, for someone who may take them ([Snapshots](../014-snapshots/snapshots.md) "In History"): **Take
  Snapshot** is no longer a form always on show: a **Snapshot** button heads the timeline and opens the Take a Snapshot
  form beside Tools as a popover (`ResponsivePopover` `placement="side"`; a drawer from the bottom on a phone), and each snapshot sits on it at the time it was taken, pinned (a camera on the brand's
  wash, labelled Snapshot), with Revert and Delete confirmed in place. Someone who may take snapshots but has no
  timeline to read (an Editor through a share link) sees the snapshots on their own; signed out, a line under them says
  Sign In shows who changed what.
- **Version History** (livedocuments): an **Open Version History** button over the timeline (or under the snapshots,
  or under the sign-in prompt). It gives the whole window over to one tab's pages beside its versions, which no
  popover can hold, so pressing it closes Tools. Where History has nothing else for this person (a Participant through
  a share link), the History row opens Version History straight away and closes Tools, as its own row did.

Its line reads "Snapshots, and who changed what." where snapshots are in it, "Who changed what, and when." otherwise.
Signed out or Offline with no snapshots to take, History keeps its badges and its gate (Always there, below).

- Opening it focuses its first control. Up and down walk the rows, Home and End go to the first and last, Tab
  moves through them; Escape or a press outside closes it and focus goes back to Tools.

## Opening a tool inside Tools

Owner, 2026-11-16 (Work Tracker 1182): a tool opens in the Tools popover itself, so people stay in one place and can hop
between tools, never in a modal of its own on top of the editor.

- **The main button stays at the foot** (owner, 2026-11-17). A tool's main action (Record Walkthrough; New Slide and
  Present in Slide Deck) is pinned at the bottom of its view, and only the content above it scrolls. The Connections
  list does the same with Add Connection.
- **Every tool is the list's height** (owner, 2026-11-17). Opening a tool keeps Tools exactly as tall as its list:
  a short tool fills it, its main buttons at the very bottom, and a long one scrolls inside it with those buttons
  pinned and always in view. Tools never jumps in height as you move between the list and a tool.
- **A tool loads in its empty shape** (owner, 2026-11-17: opening a tool juddered). Most tools open empty, so while a
  tool's code or data loads it draws its explainer's skeleton (the art's frame, the heading, two lines, the steps)
  with its footer and a button's place pinned at the foot (`ToolSkeleton`, `ToolExplainerSkeleton` in
  `@liveworkspace/ui/tool-explainer`). An empty tool then fills in where it stands, nothing moving; the
  Connections list shows its real footer, Add Connection waiting, from the first frame.
- **The drill-in.** Choosing a row replaces the list with that tool's view. Tools' illustrated hero band stays at the top
  of every view (owner, 2026-11-17), with its close in the corner; under it the shared
  [back bar](../../../../livediagram/docs/specs/004-interface-design/back-bar.md) is the breadcrumb: **Tools**, with the
  tool's name in its chip ("Tools > History"), and no close beside it (the band's is the one close). The tool's own header loses its
  title (the chip names it) and its close (the popover's closes it), and its one line too (owner, 2026-11-17: the tool explains
  itself below), keeping only its actions in a slim row under the bar. Everything else is the tool as it was: its form, its list, its
  footer, its sides coming in to the bar's 16px so the whole view shares one left edge.
- **Back.** The back bar returns to the list, as does the tool's own Cancel or Done. A tool that holds unsaved work
  (Automations' rule builder) asks first, as its own close did. Escape steps back one level (a confirm or a menu open
  in the tool first, a snapshot's in-place confirm among them), then closes Tools from the list. The close shuts Tools from any level.
- **Sizes.** Every tool takes Tools' own width, 480px (owner, 2026-11-17), so the popover's sides never move. Each view takes
  its own height, never under **500 px** (owner, 2026-11-17; a shorter screen caps it), or a taller floor an app asks for (`minPx`: liveknowledge, with few tools, takes liveplanner's 785 px, and an open tool fills that floor too, its footer at the bottom; owner 2026-11-21) (Email to Board is short, History tall), the popover easing smoothly to it whenever it grows or shrinks. A press outside closes Tools, except for a tool marked to stay open (livediagram's Slide Deck, used alongside the canvas), which only its close button or Escape shuts
  (owner, 2026-11-17), up to the room above the button; past that it scrolls inside under the band.
- **Stepping aside** (Work Tracker 1287). A tool that works on the canvas from a bar of its own (Walkthroughs while
  picking what to hide) marks itself `stepAside`: Tools stays open, its view and state kept, but is drawn out of sight
  (`visibility: hidden`, so it takes no press and no focus) until the tool clears the mark. A `stepAside` tool is also
  kept open, as `keepOpen`'s are.
- **Motion** (owner, 2026-11-17). Going into a tool slides its view in from the right, as a phone opens a menu; going
  back slides the list in from the left (`animate-view-forward` / `-back`, short motion), while the popover's height
  eases between the two (`AnimatedHeightBox`), and again whenever a view's own content grows or shrinks. Reduced motion keeps only the fade.
- **Skeletons.** A tool that reads its content (History's timeline, the Connections list, Email to Board's address, Subscribe
  to Calendar's feed) shows skeleton rows of its own shape while it loads, never a spinner that changes the height when
  the rows land.
- **Inside a tool.** A dialog a tool opens on top of itself (Automations' Describe a Rule, a Discard Changes confirm,
  Connections from a rule) is still a dialog, drawn over Tools; a press in it, or in a menu a tool opens, never closes
  Tools.
- **Focus.** Opening a tool moves focus into its view (the back bar, or the control the tool focuses itself, such as a
  confirm's button); stepping back puts focus on that tool's row. A polite live region says where focus went
  ("History", "Tools"), and the popover's name follows ("Tools, History").
- **On a phone** the drawer keeps the full width and its own height cap (85% of the screen), the tool scrolling inside
  it.
- **Waiting.** A tool whose code has not loaded yet shows skeleton rows under its back bar until it arrives, at about the
  height its view will have.
- **From elsewhere.** Coming back from signing in with a tool asked open (`?calendarFeed=1`, `?emailIntake=1`) opens
  Tools at that tool. Automations always opens its own full-screen dialog, so `?automations=1` opens that dialog on the
  rules, as do the other ways in from outside Tools: a card's Run Rule, an Automation comment's link to its rule, and
  coming back from GitHub.

## Performance

The popover's rows are worked out from state each tool already holds (its door, the rules the host fetched); opening it
fetches nothing. Each tool still loads its code the first time it opens, now into Tools rather than a modal. Opening a
tool renders only that tool: the list unmounts behind it.

## On a phone

Tools and Get Started are drawers on a phone: a bottom sheet across the screen's foot over a dim scrim, the hero
band running up under its grab handle. Dragging the handle down, a tap on the scrim or Escape closes it, and focus
goes back to its button (`PopoverOrSheet`, `packages/workbench/src/components/primitives/PopoverOrSheet.tsx`). A
second press on either button closes what it opened, on every screen.

## Rows from outside the footer

The open item's **History** comes from each editor's `ItemToolsHost`, which holds the item and the reader: it
publishes the row through the Tools door (`usePublishToolsItems`,
`packages/workbench/src/components/chrome/tools-door.ts`; `useItemToolsRows`), and the popover lists it beside the
rows its host hands it. The host also takes the app's Snapshots (`useHistorySnapshotsHost()`), and livedocuments'
footer offers Version History to it (`usePublishItemVersions`), so History holds all three.

Each canvas editor's walkthroughs publish their **Walkthroughs** row the same way, from where the editor mounts them
(`WalkthroughsTools`, `@liveworkspace/walkthrough`), so the footer needs to know nothing about them.

Inside an editor, History is on no item's ⋯ menu: the editor's Explorer panel passes `history={false}`, and Tools has
it for the open item. The Explorer on liveworkspace.app, with no footer, keeps it on its item menus.

**Webhooks is not a tool** (2026-11-20): no row in Tools, no item on any ⋯ menu, no dialog of its own. What is left of
a webhook is a connection, managed on the **Connections** tab inside Automations
([automations.md "Connections"](../018-automations/automations.md#connections)).

### Always there

A tool that would work for this person but for an account or for where the item lives **always shows** in Tools
(owner, 2026-11-16), so everyone can find it, with small badges beside its name saying everything it needs, in order:
**Sign In** (it needs an account), then **Sync Plan** (the app's own noun: Sync Canvas, Sync Document, Sync Design,
Sync Space; it needs the item saved to the server). Signed out on an item kept Offline, it wears both. A press opens
that tool's gate in its place, in Automations' shape, on the first thing it needs: Sign In leaves for the sign-in page
and comes back with the tool open; Sync syncs in place and goes on to the tool. Where neither would help (a share-link holder for a tool only an
owner has, a Viewer for an Editor's tool, an embed) the row stays out. In liveplanner: Automations, Subscribe to Calendar and Email to Board; everywhere: History (Sign In,
then Sync), and in the four canvas apps Walkthroughs (owner, 2026-11-17), when it has none to play: it wears the item rows'
badges and opens their gate through the Tools door (`usePublishToolGate` / `useToolGate`, blueprint FM10), and once
synced Tools opens at its own row.

Signed out, or on an item kept Offline, **History** still shows in Tools (owner, 2026-11-16), so
everyone can find it, badged **Sign In** and **Sync <Item>** as it needs. A press
opens a small dialog in that tool's hero header (its art, name and line), a sentence on what signing in gives, and
**Sign In** (to the app's sign-in page, coming back here) beside **Not Now**. Signed in, it behaves as above: History for
an item not shared by link.

There is no Connect group: connections are inside Automations, in **Automate**.

liveplanner adds two of its own (owner, 2026-11-16), moved out of the tab menu so the tools that work on the whole plan
live in one place: **Email to Board** in Automate, under Automations (mail in becomes cards with nobody filing them) and **Subscribe to
Calendar** in Collaborate (the plan's dates in everyone's own calendar). Each shows under the same rule it had in the tab
menu and opens the same dialog.

## Explainers

Where a tool screen has little to show yet (nothing set up, nothing recorded), it opens on an **explainer** (owner,
2026-11-17) rather than a line of text: the tool's own illustration (a 280 by 120 drawing in the brand and slate ramps,
on a faint dot grid in a soft brand-tinted card, its moving part bobbing gently and still under reduced motion), a
title, one line on why you would use it, and two or three numbered steps, then the screen's own action. It is roomy
(owner, 2026-11-17, "use the space better"): the drawing drawn at 140 px tall with 28 px over it, the title at 16 px
with 24 px under the line, 16 px between the card, the steps and the action, the steps 10 px apart on 24 px numbers.
It is one shared
component (`ToolExplainer` and `tool-explainer-art` in `@liveworkspace/ui`), so every sparse screen reads alike:

| Tool                  | Title                                                   | When          |
| --------------------- | ------------------------------------------------------- | ------------- |
| Email to Board        | Mail In, Cards Out                                      | Not turned on |
| Connections           | No connections yet                                      | None added    |
| Subscribe to Calendar | This Plan in Your Calendar / Your Work in Your Calendar | No link made  |
| Walkthroughs          | No walkthroughs yet                                     | None recorded |
| Slide Deck            | Build Your Deck                                         | No slides     |

A tool screen that loads in steps never shrinks and grows back: after a tool opens, Tools only grows, and any shrink
waits until nothing in it is loading (no `aria-busy`, as every skeleton carries) and it has held still for 120 ms (at
most 2.5 s), then eases there once.
