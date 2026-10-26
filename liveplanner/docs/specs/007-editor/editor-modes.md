# Editor mode

Every tab is worked on in one **editor mode**, **Plan** ([Plan mode](../026-plan/plan-mode.md)): boards of cards,
Sheets, Dashboards and Forms, with the canvas under them. There is nothing to choose and nothing to switch: a tab
never changes mode, a new tab and a new Project open in Plan, and an empty tab opens on **Start Planning**
([Plan mode](../026-plan/plan-mode.md#starting-a-board)). This spec keeps what the editor mode still means to the
project model, to stored data and to the look every tab shares; how Plan works is [Plan mode](../026-plan/plan-mode.md).

There is no other mode and no switch between modes (see "Other mode ids").

## Domain language

| Term            | Means                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **tab kind**    | What a tab **is** ([Project](../006-project/project.md)): the general tab, or a Board, Sheet, Dashboard or Form.        |
| **editor mode** | How a tab is worked on: always `plan` (`EditorMode`, `EDITOR_MODE_CATALOGUE` in `packages/project/src/editor-mode.ts`). |

- "Mode" on its own is ambiguous (Zen mode, Presentation mode, Power user mode); in specs and code say **editor
  mode**. The interface says **Plan** where it names the mode at all (a project's Type in the Explorer's Details
  view, the "New projects that open as" default-folder list).

## Where the mode is named

The mode is not stored on a tab, but it is named wherever a project's mode is recorded or sent, so it
stays declared once (`EDITOR_MODE_CATALOGUE`, `EditorMode`, `EDITOR_MODES`, `isEditorMode`):

- **A project's recorded creation intent** (`intent.mode`, the `opens_in` column, `ProjectSummary.opensIn`;
  [Default folders](../013-workspace/default-folders.md) "Recorded intent"): `plan` for every new project.
- **Tab stats** (`TabStats.mode`, the `tab_stats.mode` column; [Explorer details view](../013-workspace/explorer-details-view.md)):
  `plan` for every tab.
- **The default-folder key `mode:plan`** ([Default folders](../013-workspace/default-folders.md)): the fallback key
  every new Project tries after its kind's and template family's.
- **The Explorer filter `opens-in:plan`** ([Explorer filters](../013-workspace/explorer-filters.md)).
- **The returning-visitor note** (`RecentDiagram.mode`; [Returning visitor](../019-marketing/returning-visitor.md)).

## Other mode ids

liveplanner has one mode. There is no mode switch, no Shift+D, no mode rows in the tab menu, no `/new` mode step and
no per-mode template start or palette. Stored data never names another mode, and an id that does is handled so:

- **A tab's `opensIn`** is not part of the `Tab` type and is ignored where it is read: every tab is in Plan.
- **A stored mode id anywhere else** (a recorded intent, a tab-stats row, a returning-visitor note, an
  `opens-in:` filter, a create's `intent.mode`) is read through `parseEditorMode`: `plan` reads as itself, and
  anything else reads as unknown.
- **A stored default-folder key of a retired mode** (`mode:diagram`, `mode:draw`, `mode:workshop`, `mode:pages`,
  `mode:illustrate`, `mode:infographic`, `mode:facilitate`) is not in force: it is left out of the person's
  defaults and never answers a create; the row stays until it is cleared. A request naming one is refused as an
  unknown key (`default_key_invalid`).
- **A `/new?mode=` link** is ignored: `/new` makes a blank Project ([New project route](new-project-route.md)).
- **A remembered mode** in a browser (`liveplanner:v2:editor-mode:<tab>`) was already unread and stays so.
- Elements a retired mode made (pen strokes, pages, articles, workshop tools) are not converted; what is still an
  element kind draws as it always did.

## One look

There is one look. **The editor chooses the defaults written into new content and the backdrop behind it; it never
re-colours what is already there.** Every colour is stored on the element, so collaborators see the same element in
the same colour.

- **The canvas.** The canvas colour is the tab's own: its theme's canvas, or the custom background colour when one is
  set. While the tab keeps its theme's pattern the canvas is **blank**, so boards, sheets and dashboards carry the
  page; a pattern someone picked always shows. Nothing is stored for the blank canvas, so exports, thumbnails and
  api or MCP images keep the tab's own backdrop (`resolveViewBackdrop`, `resolveTabBackdrop`).
- **Off-white light canvas.** The Default theme's light canvas is the board's off-white (`#fbfaf7`); its dark canvas
  stays `#0d121a`.
- **Ink is one colour everywhere.** **Ink**, the drawing colour (`#1c1917` on a light canvas, `#e2e8f0` on a dark
  one), is the same on every theme and stored by name. Pen strokes and text with no colour of their own are drawn in
  Ink.
- **Marker colours are first-class.** The stock colours (Ink, Grey, Blue, Red, Orange, Yellow, Green, Teal, Violet,
  Pink) are stored by name on any element and drawn in the version tuned for **the canvas behind them**, light or
  dark, on every tab, in every export, thumbnail and image the api or MCP renders. On the Default theme that canvas
  follows the viewer's appearance; a theme with a fixed canvas keeps its ink readable whichever appearance is on.

## A text box's sizing

What a rule writes, stays: a rule that shapes content is stored on the element when it is made. A text box's sizing
is one field, `TextElement.sizing`:

- `'fit'`: the width follows the words up to the wrap width, and the height hugs the lines;
- `'wrap'`: the width is set, and the height hugs the lines;
- absent: a fixed box, its text wrapping inside it.

## The tool Plan starts with

Plan starts on **Hand**, since a board's cards take the pointer themselves; any tool can be picked after, and
**Eraser** and **Format** are left out ([Plan mode](../026-plan/plan-mode.md#tools)).

## Existing whiteboards

A stored tab with `kind: 'whiteboard'` reads as a general tab; its elements, background and layers are unchanged

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

There is no mode switch, so `Editor` · `Changed` · `Mode<Mode>`, `Tab` · `Changed` · `PageFitToContent` and
`UI` · `Used` · `StartOtherMode` are not sent; the retired ones are listed in liveworkspace's `../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts` ([liveworkspace/docs/telemetry.md](../../../../liveworkspace/docs/telemetry.md)). Default folders report the one remaining mode key as
`DefaultModePlan`.

## Non-goals

- A second editor mode until use asks for one.
- Converting a retired mode's content into Plan's.

## References

[Plan mode](../026-plan/plan-mode.md), [Plan tabs](../026-plan/plan-tabs.md), [Project](../006-project/project.md),
[Default folders](../013-workspace/default-folders.md), [New project route](new-project-route.md).
