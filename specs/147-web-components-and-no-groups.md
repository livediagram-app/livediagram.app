# 147 — Web components are elements; groups are gone

Status: shipped

## What

Two changes that ship together, because the second cannot land before the first:

1. The palette's **Components** (Banner, Callout, Stat row, Process steps, Hero, Header) stop
   being bundles of primitives held together by a shared `groupId` and become **single
   elements**, each with a layout that re-flows as it is resized and every piece of text
   editable in place.
2. **Groups are removed from the editor**: the `groupId` field, the Group / Ungroup actions and
   `⌘G`, group mode, group selection and drill-in, the group toolbar actions, group
   quick-connect and its `pinned-group` arrow endpoints, and the Eraser's "whole group" option.

## Why

Groups cost more than they gave. Every selection, drag, delete, duplicate, lock, layer, eraser,
quick-connect and clipboard path had a group branch, and the interactions (select the group,
click again to drill in, no resize, group mode to extend one) were a steady source of "why did
that happen". What people actually wanted from them is covered by the marquee multi-selection
(move, align, style, delete many at once) and by frames.

The one real dependency was the palette: six Components were built as grouped primitives. A
component built that way comes apart the moment a user drags the wrong piece, resizes as a
uniform zoom of loose boxes (so text and padding scale together), and can only be edited by
drilling into the group. The Entity (spec/120) already showed the better answer for the UML
class box: make it one element.

## The elements

Each is a `ShapeElement` kind except the Hero, which is an image (see below). All of them keep
the ordinary element behaviours for free: move, resize, rotate, lock, layers, colours, font,
shadow, comments, links, copy / paste, undo.

| Kind          | Text                                                    | Rows (bounded)                        |
| ------------- | ------------------------------------------------------- | ------------------------------------- |
| `banner`      | `label` = title, `pageSubtitle` = subtitle              | —                                     |
| `callout`     | `pageTitle` = heading, `label` = body                   | —                                     |
| `stat-row`    | —                                                       | `stats: { value, caption }[]`, 1 to 6 |
| `process`     | —                                                       | `processSteps: string[]`, 2 to 8      |
| `site-header` | `label` = brand                                         | `navLinks: string[]`, 0 to 6          |
| image hero    | `heroCaption: { title, subtitle }` on an `ImageElement` | —                                     |

**The label is the main text wherever there is one**, so double-click edits it with the normal
label editor (rich text, alignment, size, bold) exactly like any shape. The masthead lines
(`pageTitle` / `pageSubtitle`) are the same single-line plain strings the Page element uses
(spec/100), reusing its field names, bound and setter rather than inventing a parallel pair.

**Every other piece of text edits in place** once the element is selected: click a stat's value,
a step's caption or a nav link and type. Enter commits, Escape restores. Before the element is
selected the text is inert, so a press anywhere on it still selects and drags it (the first click
selects, the second edits, the same rule the timeline rail uses).

**Rows are added and removed from the context menu** (a Stats / Steps / Links section in the
Tools flyout, beside the checklist and entity editors), and from a **+** on the canvas at the end
of the row while a stat row or process is selected.

## Resizing

The point of making them single elements is that they can lay themselves out. Each layout is a
pure function in `@livediagram/diagram` (`web-components.ts`) that both the canvas view and the
headless SVG renderer call, so an export matches the editor.

- **Banner / callout**: the text region is the box minus its padding. Title and body re-wrap to
  the width; nothing scales with the box except the room the text has.
- **Stat row**: the cards share the width equally with a fixed gap. The value's font size follows
  the card height (clamped), so a taller row gets bigger numbers rather than more empty card.
- **Process**: the steps spread evenly across the width, connectors run between neighbouring
  circles, and the circle diameter follows the smaller of the height and the step spacing, so
  adding a step on a narrow element shrinks the circles instead of overlapping them.
- **Header**: the logo and brand sit left, the links right-aligned; widening the bar opens the
  gap between them, and links that no longer fit are dropped from the right rather than
  overlapping the brand.

## Colours

- **Banner and Header** paint their bar in `fillColor`, falling back to the stroke (the theme
  accent) when unset, with white text by default. Theme switches retheme only their stroke
  (`THEME_COLOUR_FIELDS` exception), because writing the theme's pale element fill into an
  accent bar under white text is how the old grouped banner went unreadable.
- **Callout, Stat row, Process** are ordinary cards: the theme's surface fill and ink text, with
  the accent (stroke) for the badge, the values and the step circles.
- **Hero**: the caption card is the image's `fillColor` (the theme accent at creation), white text.

## The hero is an image

A hero IS an image with a caption card on it, so it is an `ImageElement` with an optional
`heroCaption`. Keeping it an image means upload, the picker, offline conversion, export
embedding and the image menu all keep working with no second image pipeline. The caption card
can be turned off and on from the image's context menu, which also means any image can become a
hero.

## Existing diagrams

- Components already on a board were built as loose primitives and **stay as they are**: once
  groups are gone they are simply separate elements. We do not try to recognise and fuse them.
- `groupId` on stored elements is **ignored** and stripped on load.
- A legacy `pinned-group` arrow end is **frozen to a free endpoint** at the position it resolved
  to, by `migrateLegacyGroups`, at the two boundaries where stored tabs enter: the api worker's
  `rowToTab` (so the editor, MCP, share links and thumbnails all see migrated data) and the
  offline store's tab load. The validator still accepts the legacy endpoint shape on write, so a
  browser running a cached pre-change build can still save; the next read migrates it.

## Removed

- Group / Ungroup in the selection popover, multi-selection toolbar and context menu; `⌘G`.
- Group mode (the "Click another element to add to the group" pill).
- Group selection, drill-in (`soloSelectedId`), and group-aware drag / delete / lock / layer /
  duplicate / clipboard / format-painter / insert-between paths.
- Group quick-connect and `pinned-group` endpoints (except the load-time migration above).
- The Eraser Panel's "whole group" toggle (spec/113).
- Excalidraw import no longer maps `groupIds` (grouped Excalidraw elements import as separate
  elements); export no longer writes them (spec/87).
- The help article on groups.
