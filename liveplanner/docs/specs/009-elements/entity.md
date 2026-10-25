# The entity

**Status in liveplanner: editing removed (2026-10-24).** No Plan tab holds entities ([Plan mode](../026-plan/plan-mode.md)), so the Fields menu, Add Field / Add Related Entity on the ring, and the Cardinality presets are gone, with their wiring in `useEditorState`. The element kind stays in `packages/project` for the file format; this spec describes livediagram's behaviour.

## What

An **Entity**: a title bar over a list of fields, each a `name`, an optional type and an optional key. One
element covering the UML class box and the ER entity (table) box, and the place a data model is built: entities
grow fields where they stand, and join one another field to field with relationships that carry their
cardinality.

## Why

The UML class template built one out of, in its own words:

> two flush-stacked tables sharing a groupId… so the seam between the tables
> draws the attribute / method separator

That is two elements pretending to be one, held together by a group, with a
border seam standing in for a divider. Move one half and the class comes apart.

Structured notation (UML, ER, BPMN) is where draw.io beats everything else,
and engineering teams sketching architecture are the first group
[Purpose](../001-project-vision/purpose.md) names.

A data model is more than boxes. What a schema review reads is the keys (which column is the primary key,
which ones point elsewhere) and the joins (which column points at which table, and how many on each side). A box
of `name: type` rows joined by plain arrows from edge to edge says neither, so the entity draws its keys, and a
relationship lands on the very field it is about.

## The element

`shape: 'entity'`, one field of its own:

```ts
entityFields?: { name: string; type?: string; key?: EntityKey }[];
type EntityKey = 'pk' | 'fk' | 'pk-fk' | 'uk';
```

Bounded at 40 rows / 80 characters, like the checklist ([Checklist](checklist.md)), so a paste
can't produce an element nobody can read.

**The element's `label` is the title.** An entity needs no separate name field,
and using the ordinary label means the title edits, formats, aligns and exports
like every other label. Only the rows are bespoke.

`type` is optional because half the uses don't carry one (an ER attribute
list, a rough class sketch), and an empty column reads better than a
placeholder. It stores as `undefined` when cleared, so a row that never had a
type round-trips identically to one that had it removed.

### Keys

`key` is the field's role in a data model: **PK** (primary key), **FK** (foreign key), **PK FK** (both, the
composite key of a join table) or **UK** (unique). Absent means none, and is stored as no key at all. One value
rather than a set because those four are the combinations a schema actually uses, and one value is one press to
cycle.

Fields written before keys existed carried them in the type text, the way a DBA writes them (`uuid PK`,
`uuid FK, null`, `PK FK`). Those still read as keys: a field with no `key` whose type ends in key words shows the
key and the type without them. Nothing is migrated; the first edit to the field stores it the new way.

## How it looks

- **The title bar** is a tinted band: the element's `headerFill` when set, else its border colour at a light tint,
  so an entity reads as a table at a glance and recolours with its theme. A 1px rule closes it.
- **Field rows** sit on faint alternating stripes, so a long row is easy to follow across.
- **A key gutter** opens on the left when any field has a key: a key glyph for PK (amber, the colour every database
  tool uses for it), a link glyph for FK, a small `U` for UK, and both glyphs for PK FK. An entity with no keys
  has no gutter, so a class box loses nothing to it.
- **Names** are left; a PK name is semibold. **Types** are right, muted and in the monospace face, so the column
  scans as types. A long type shortens first and never takes more than half the row.
- **Rows past the box** are clipped, as before; an editor change to the fields resizes the box to fit them
  ("The box follows its fields").

The export draws the same band, stripes, gutter and glyphs, so a PNG or SVG matches the canvas.

## Editing on the canvas

An Editor edits an entity where it stands:

- **Double-click a field** to edit it in place: the name and the type become inputs over the row. **Enter** saves
  and moves to the next field (adding one after the last), **Tab** steps name, type, next field, **Shift+Tab**
  steps back, **Escape** and leaving the row save (Escape keeps what you typed, as on every canvas label). A field emptied of both name and type is removed when
  it is saved.
- **Double-click below the last field** adds a field and edits it.
- **Double-click the title** edits the title, as on every element.
- **The key** cycles with the small key button at the start of the row being edited: none, PK, FK, PK FK, UK.

## Growing a model: the quick-connect ring

An entity's quick-connect ring (the "+" on each side) offers:

- **Add Field** on the bottom ring: appends a field and edits it in place.
- **Add Related Entity** on every ring: a new entity on that side, already joined. It is titled "Entity" and
  opened for its title; it has an `id` field (PK) and a foreign key field named after the source
  (`customer_id` from "Customer"), both typed like the source's primary key (or `uuid` when it has none). A
  relationship runs from the source's primary key field (or its title when it has none) to the new foreign key
  field: one at the source, many at the new entity.
- **Arrow** and **Duplicate**, as on any box.

## Relationships

A relationship is an ordinary arrow. What the entity adds is where it lands and what its ends say.

### Field to field

An arrow end can pin to **one field** of an entity: the endpoint carries the field's index beside its anchor.

```ts
{ kind: 'pinned', elementId, anchor, field?: number }
```

The end then meets the entity's left or right edge (whichever its anchor is on) level with that field's row, and
follows the field as the entity moves or resizes. Dragging an arrow end over an entity's field rows pins it to
the row under the pointer, on the side facing the arrow's other end, and the row highlights; over the title it
pins to the entity as a whole, as on any shape. When the entity moves past the other end, the end swaps sides
and stays on its field. An end on an anchor at the top or bottom, a field index past the last field, or a field
scrolled out of the box falls back to the plain anchor.

Removing a field from the Fields menu or in place lets go of any end pinned to it (the end stays on the entity)
and moves ends on the fields after it up by one, so every end keeps its field.

### Cardinality ends

An arrow drawn between two entities, in one drag, that carries no arrowhead choice of its own becomes a
relationship as it is released: crow's-foot ends at both tables (the ER ends of
[Arrowhead shape](../008-canvas/canvas-and-palette.md)). The end on a foreign key field is **many**; the other is
**one**; with no foreign key on either end, the end drawn from is one and the end drawn to is many.

A selected arrow joining two entities shows a **Cardinality** button in its toolbar, labelled with the current
pair (`1 : N`), that opens the presets: One to One, One to Many, Many to One, Many to Many, Zero or One to Many,
One to Zero or Many. Each sets both ends at once; the arrow menu's per-end shapes stay for anything else.

## The box follows its fields

The editor changes an entity's fields from the Fields menu, from in-place editing and from the ring. Each change
resizes the box to its fields: the height that shows every row ("Authored size" in the blueprint), plus whatever
extra height the person had given it before. So adding a field never hides it below the box, and removing one
never leaves an empty tail, while a box someone stretched on purpose keeps its extra room.

## The Fields menu

The rows also live in a **Fields** section in the right-click menu (under the Tools flyout, where the other
data-shape editors sit), mirroring the checklist's row editor: a key button that cycles the key, a name input, a
type input, a remove button, and Add Field.

## Not two compartments

A UML class conventionally has _two_ compartments (attributes, then methods).
It has **one** list, because the divider is the only thing that differs and
a second bounded array doubles the model, the editor and the renderer for it.
A method row is `render(): void` in the name column, which is what the
stacked-tables template was spelling out by hand anyway.

## The title bar follows the title

The band's height is derived from the element's **text size**, not fixed: a
flat 30px suits only the 16px label, and at `lg` the title is a 32px font, so a
fixed band would let the rule cut straight through the word. The height comes
from the same px table the label itself uses (`FIXED_FONT_PX`), times the
`leading-tight` line height, plus the label's vertical padding, with a 30px
floor so an entity at the 16px size keeps a 30px band.

## Imports, templates and agents

- **Mermaid ER import** ([Mermaid](../020-import-export/mermaid.md)) writes an attribute's `PK`, `FK` and `UK`
  markers as the field's key, and its relationships keep their cardinality ends.
- **The database schema template** writes its keys as keys.
- **Agents** (the MCP server and the CLI) read and write `key` on a field and `field` on a pinned end; the
  text views of a tab show a field's key beside its type.

## Share roles

| Role        | May                                                                                  |
| ----------- | ------------------------------------------------------------------------------------ |
| Editor      | Everything above: edit fields in place and in the menu, the ring's adds, cardinality |
| Participant | Nothing entity-specific: reshaping a diagram is an Editor's ([Share roles][roles])   |
| Viewer      | Looks: the keys, stripes and field-pinned relationships render; nothing is a control |

[roles]: ../013-workspace/share-roles.md

In-place editing, the ring's adds and the Cardinality button are an Editor's: they render only in an editing
session (not read-only, so never for a Participant or a Viewer) on an unlocked entity, and not at all otherwise.
A Participant's element writes (`applyParticipantOp`) do not take `entityFields`, so the server agrees.

## Element tour

Removed from liveplanner with the element tours ([Element tours](../007-editor/element-tours.md)): no Plan tab
places this element. The Entity tour was offered from a small **Show Me** toolbar beside the first one a person
selected; in livediagram an element's tour is now started from the footer's Start Tour button while the element
is selected, never from a toolbar beside it.
