# The footer's Tools menu

Every editor's footer cluster (`ChromeControls`, each product's [Editor app](../../../../livediagram/docs/specs/007-editor/editor-app.md)
"Tab bar") used to carry a button for each tool that works on the whole item: **Automations** (liveplanner),
**Snapshots** (every app), **History** (livedocuments) and **Search** (every app), and the title bar carried
**Suggest** (every app with suggestions). Each was a word and an icon in a bar that is mostly
about the tabs, so the cluster grew noisy as tools arrived. They now sit behind one **Tools** button, so the bar holds
Settings, the appearance and one way into the rest.

## Where it sits

- **Tools** leads the cluster, before Settings. The **Start Tour** button, when a tour is on offer, comes before it.
- Its glyph is a toolbox. Labelled **Tools** from `sm` up like its neighbours (unless **Button Labels** is off),
  icon-only on a phone (a 40 px target, named "Tools"). It has no hover card: its label says what it is, and the
  popover says the rest.
- It is drawn only while it holds at least one tool. Someone who may use none of them (a Viewer, a Community visitor,
  a workbench frame, an item in **This Browser** without Automations) sees no Tools button at all, never an empty popover.
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
(Search), **Automate** (Automations, liveplanner's Email to Board, then Webhooks), **Collaborate** (Suggest Changes, and
liveplanner's Subscribe to Calendar), **Versioning** (History, Snapshots, Version History). Each
group is a labelled group for screen readers; the arrow keys walk the rows straight through the groups.

| Row                 | App                                                 | Drawn when                                                                                                                  | Opens                                |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **History**         | every app                                           | signed in, the open item not shared by link (no longer on the item's ⋯ menu inside an editor)                               | the History dialog for the open item |
| **Webhooks**        | every app                                           | as its row on the item's ⋯ menu was (gone from the Explorer header's and every item's menu inside an editor)                | the Webhooks dialog                  |
| **Search**          | every app                                           | the host offers search (the editor and the Explorer's bar)                                                                  | the Search dialog                    |
| **Automations**     | liveplanner                                         | as its button was ([Automations](../../../../liveplanner/docs/specs/026-plan/automations.md) "The footer button")           | the Automations screen               |
| **Suggest Changes** | livediagram, livedocuments, liveplanner, livedesign | as its header action was ([Canvas suggestions](../015-suggestions/canvas-suggestions.md) "Suggesting")                      | the Suggestions panel, beside Tools  |
| **Snapshots**       | every app                                           | as its button was ([Snapshots](../014-snapshots/snapshots.md) "In the editor")                                              | the Snapshots dialog                 |
| **History**         | livedocuments                                       | as its button was ([Version history](../../../../livedocuments/docs/specs/006-document/version-history.md) "In the editor") | Version History on the open tab      |

- **Automations** keeps its count: the rules that are on, at the row's end (none at 0), amber when a rule
  paused itself. A paused rule also puts a small amber dot on the Tools button, so the warning the button carried
  is still seen with the menu shut, and the button's name says so ("Tools, a rule is paused").
- **Suggest** reads **Suggesting** while this person suggests and keeps its count at the row's end.
  Suggestions waiting for an Editor put a brand dot on Tools ("Tools, 3 suggestions"); a paused rule's amber outranks
  it.
- Choosing a row closes the popover and opens its tool, sending the same telemetry the button did.
- Opening it focuses its first control. Up and down walk the rows, Home and End go to the first and last, Tab
  moves through them; Escape or a press outside closes it and focus goes back to Tools.

## Performance

The popover's rows are worked out from state each tool already holds (its door, the rules the host fetched); opening it
fetches nothing. Each tool's dialog still loads its code the first time it opens.

## On a phone

Tools and Get Started are drawers on a phone: a bottom sheet across the screen's foot over a dim scrim, the hero
band running up under its grab handle. Dragging the handle down, a tap on the scrim or Escape closes it, and focus
goes back to its button (`PopoverOrSheet`, `packages/workbench/src/components/primitives/PopoverOrSheet.tsx`). A
second press on either button closes what it opened, on every screen.

## Rows from outside the footer

The open item's **History** and **Webhooks** come from each editor's Explorer host, which holds the item, the reader
and the Webhooks handler: it publishes them through the Tools door (`usePublishToolsItems`,
`packages/workbench/src/components/chrome/tools-door.ts`; `useItemToolsRows`), and the popover lists them beside the
rows its host hands it. livedocuments' own version history reads **Version History**, so the two never share a name.

Inside an editor, History and Webhooks are on no item's ⋯ menu: the editor's Explorer panel passes `history={false}`
and `webhooks={false}`, and Tools has them for the open item. The Explorer on liveworkspace.app, with no footer, keeps
both on its item menus.

### Always there

A tool that would work for this person but for an account or for where the item lives **always shows** in Tools
(owner, 2026-11-16), so everyone can find it, with small badges beside its name saying everything it needs, in order:
**Sign In** (it needs an account), then **Sync Plan** (the app's own noun: Sync Canvas, Sync Document, Sync Design,
Sync Space; it needs the item saved to the server). Signed out on an item in This Browser, it wears both. A press opens
that tool's gate in its place, in Automations' shape, on the first thing it needs: Sign In leaves for the sign-in page
and comes back with the tool open; Sync syncs in place and goes on to the tool. Where neither would help (a share-link holder for a tool only an
owner has, a Viewer for an Editor's tool, an embed) the row stays out. In liveplanner: Automations, Subscribe to Calendar and Email to Board; everywhere: History and Webhooks (each Sign In,
then Sync).

Signed out, or on an item in This Browser, **History** and **Webhooks** still show in Tools (owner, 2026-11-16), so
everyone can find them, badged **Sign In** and **Sync <Item>** as they need. A press
opens a small dialog in that tool's hero header (its art, name and line), a sentence on what signing in gives, and
**Sign In** (to the app's sign-in page, coming back here) beside **Not Now**. Signed in, they behave as above: History for
an item not shared by link, Webhooks for one who can manage them.

Webhooks sits in **Automate**, under Automations where the app has them (liveplanner); there is no Connect group.

liveplanner adds two of its own (owner, 2026-11-16), moved out of the tab menu so the tools that work on the whole plan
live in one place: **Email to Board** in Automate, under Automations (mail in becomes cards with nobody filing them) and **Subscribe to
Calendar** in Collaborate (the plan's dates in everyone's own calendar). Each shows under the same rule it had in the tab
menu and opens the same dialog.
