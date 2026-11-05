# Editor modes

livehuddle has **one editor mode**, the meeting board, stored as `'workshop'`
([The meeting board](../012-collaboration/workshop-mode.md)). Every tab is a meeting board, for everyone, and there is
**no mode switch**. Since Work Tracker #423 it is no longer livediagram's Workshop: the workshop kit, the Collaborate
elements and the diagram tools leave ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). livediagram's Diagram and Draw modes are not part
of livehuddle: they were cut in step 5.1 of the [Build plan](../005-project-roadmap/build-plan.md) (Work Tracker #182),
with the elements only they offered ([Purpose](../001-project-vision/purpose.md#boundaries-that-have-moved)).

## Domain language

| Term              | Means                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **tab kind**      | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                                              |
| **editor mode**   | How a tab is worked on. In livehuddle always `workshop` (`EditorMode`), kept as a type so stored tabs and shared code read one value. |
| **Workshop mode** | Running a session with a team: the Collaborate elements, stickers and the Session strip.                                              |

- "Mode" on its own is ambiguous (Avatar mode is not an editor mode); in specs and code say **editor mode**.
- "Whiteboard" names an activity, never a tab kind, a mode or a type of document.

## Kinds versus modes

- **A tab kind is for a very specific use** whose notation, rules and data are its own. livehuddle has none: its
  Event Storming boards stayed with livediagram.
- **Everything else is the general tab** (`kind: 'diagram'`, the default, a stored name kept for compatibility).

## There is no switch

- No mode switch beside the menu button, no switch on an empty tab's start, no mode menu, no Shift+D, no mode step on
  `/new`, no mode filter in the template picker, no "Opens in" filter values other than Workshop in the Explorer.
- Nothing in the tab menu, the tab bar or the Explorer offers a mode.
- Every role sees the same: there is nothing to switch, so the mode gates nothing by share role.

## Where the mode lives

- **A tab's stored mode** is `Tab.opensIn` (the field keeps its stored name). Every value reads as Workshop
  (`opensInOf`, `parseEditorMode`): `'workshop'`, `'diagram'`, `'draw'`, the legacy `'facilitate'`, `'pages'`,
  `'plan'`, `'illustrate'` and `'infographic'`, an unknown string and an absent field alike. So a tab copied or
  imported from livediagram in Diagram or Draw opens in Workshop with every element it still holds.
- A tab the editor writes carries `opensIn: 'workshop'`; nothing is migrated.
- A per-browser mode key (`livehuddle:v2:editor-mode:<tab>`) is never read.
- **A new tab** from the tab bar's **+** or the command palette's **Create New Tab** is a general Workshop tab, opening
  empty on Start a Space ([Template starts](start-diagramming.md)). **Duplicate** keeps the original's content.

## What a tab written elsewhere keeps

- **Elements stay as stored.** A rule that shapes content is stored on the element when it is made, so content from a
  livediagram Diagram or Draw tab looks the same here: Ink and the marker colours are stored by name and drawn in the
  version tuned for the canvas behind them; a text box's **sizing** (`TextElement.sizing`, `'fit'` or `'wrap'`) keeps
  hugging its text. Text boxes made in livehuddle are fixed boxes (sizing absent).
- **Elements livehuddle no longer has** (mind nodes, flowchart steps' chart fields, sequence diagrams, Sankey diagrams,
  entities, the layer stack, pyramid, cycle, hub, onion and chevrons, the device frames) are not part of the element
  union. A stored element of such a kind reads as a plain square keeping its box, label and colours (validation reads
  an unknown shape kind as `square`), and the fields only those kinds read are dropped.
- A stored tab with `kind: 'whiteboard'` reads as a general Workshop tab, its elements and background
  unchanged.

## Stored tabs from other products' modes

Boards of cards, Sheets, dashboards and forms are liveplanner's (https://www.liveplanner.app); slides, articles,
infographics and other page layouts are livedocuments' (https://www.livedocuments.app), and logos, wireframes and photo
pages livedesign's.

- A tab whose mode is `'plan'`, or whose kind is Board, Sheet, Dashboard or Form, reads as an ordinary tab
  (`dropRetiredPlan`, run from `migrateStoredTab` beside `dropRetiredPages`): its `kind` and `opensIn` go, with its
  Plan-only fields, and so do its Plan board and Sheet elements. A chart that read a Sheet keeps the data it last read
  and loses its `chartSource`.
- A tab whose mode is `'pages'` (or `'illustrate'`, `'infographic'`) reads as a Workshop tab. `dropRetiredPages`
  (`packages/document/src/retired-pages.ts`) drops what only pages read: the tab's `pages`, `articles` and
  `pageOrientation`, and the elements that only make sense on a page. It returns the same object when there is nothing
  to drop.
- An ordinary element keeps what a page layout gave it, and livehuddle draws and exports it without offering the
  controls that set it: a text's **wordmark type** (`packages/document/src/wordmark.ts`), and a **combined** or
  **mirrored** path of several contours, which moves and restyles as a whole.

## The palette

There is one palette layout, the meeting palette (`apps/editor/components/palette/palette-layouts.ts`,
[The meeting board](../012-collaboration/workshop-mode.md#the-palette)), since part 3 of Work Tracker #423.

- **Identity is shared, arrangement is the layout's.** A category's glyph and its default label, blurb and band live
  in the category catalogue (`PALETTE_CATEGORIES`); a tile's identity in the tile catalogue (`PALETTE_TILES`).
- **A layout entry** names a category and may override its `label`, `description` and `band`, and list its `tiles` by
  id, in order. With no list it holds the category's own tiles (`tilesForCategory`).
- **Catalogue categories** (My shapes, Icons, Stickers) are bodies with their own content and take no tile list.
- **Popular** is the landing category: Sticky note, Text, Image, Link card, then behind a divider (`DIVIDE`)
  Room, Meeting Table, Chair, Bring Focus and Avatar Pad. No category holds an opener (the openers module went with
  the Collaborate code in part 4).
- The tool a tab starts with is **Select**; on a phone **Hand**. An embedded viewer always starts on Hand.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- No mode-switch events fire: `Editor` · `Changed` · `ModeDiagram` / `ModeDraw` / `ModeWorkshop` and the `Draw`
  category stay in the closed enums for the shared dashboard's history, and livehuddle sends none of them.

## Non-goals

- A second editor mode. Diagramming is livediagram's; drawing on its own is livediagram's Draw mode.
- Converting content between modes.

## References

[Document](../006-document/document.md), [Workshop mode](../012-collaboration/workshop-mode.md),
[Toolbar layout](toolbar-layout.md).
