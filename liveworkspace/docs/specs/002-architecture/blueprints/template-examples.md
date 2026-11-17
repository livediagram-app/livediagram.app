# Template example content

Derived from [architecture.md](../architecture.md) "The shared element model" (Work Tracker 1181). Each product's own
spec says what its people see: livediagram's and livedocuments' `docs/specs/006-document/template-examples.md`,
livedesign's `docs/specs/006-design/template-examples.md`. liveplanner's example cards are its own
(`liveplanner/docs/specs/026-plan/plan-templates.md` "Example cards") and this module is their counterpart for canvas
elements.

## What is an example value

`exampleValuesOf(el)` (`packages/element-model/src/template-example.ts`) reads, by kind:

| Element                                 | Example values                                       | Kept as structure                                                        |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `sticky`                                | its text (`label`, with `richText` its mirror)       | colour, size, place                                                      |
| a `shape` with `checklistItems`         | every row's text and tick                            | the number of rows, the card                                             |
| `table`                                 | every body cell (outside `headerRow`/`headerColumn`) | header row, header column, cell looks                                    |
| a `shape` with `pieSlices`/`lineSeries` | the numbers                                          | slice and series names, categories, look                                 |
| anything else                           | none                                                 | all of it (text boxes, shape labels, headings, lanes, the template note) |

An element whose values are all empty (a blank sticky, an empty table body, a zeroed chart) holds none.

Free text is never an example: a heading, a quadrant title, a poster's or wireframe's copy is the template's design,
and an emptied text box draws nothing, so clearing it would leave invisible boxes.

## The mark

`markTemplateExamples(elements)` stamps every element holding example values with `templateExample`: an FNV-1a hash
(base 36) of those values. It is a fingerprint, not a flag, so nothing has to clear it when someone edits: an element
is an **untouched example** (`isUntouchedExample`) while the hash of its current values equals its mark. Typing in a
note, ticking a row (a `check` delta), editing a cell, a peer's change or an agent's `set` all break the match, from
any path. Moving, resizing or restyling never does.

The field is an extra the products' element types do not name: validation is lenient on unknown optionals, every
store keeps it, and the edit operations never offer it to an agent.

Where it is stamped: only where a **person** lands a template, after the theme recolour: each editor's
`useTemplateFlow.chooseTemplate` (a start's pick, every tab a multi-tab template makes) and `lib/template-builders`'
`buildTemplatedTab(s)` (the /new create). An agent's template (the MCP's `template`, a changeset's `replace`) is
unmarked: an agent fills a template with real content.

## Clearing and keeping

- `clearTemplateExamples(elements)` empties every untouched, unlocked example (a sticky's text and runs, a
  checklist's rows to `{ text: '', done: false }` at the same count, a table's body cells to `''`, a chart's numbers
  to `0`) and drops every mark, untouched or not. An element a person changed keeps what it holds; a locked one is left
  as it is. Unmarked elements come back as the same objects.
- `keepTemplateExamples(elements)` drops every mark.
- `clearTabExamples(tabs, tabId)` and `keepTabExamples(tabs, tabId)` apply them to one tab for the editor's
  `commitTabs`, leaving every other tab (and a tab with no mark) the same object. One commit is one undo step, so Undo
  brings back the values and the marks together.
- `hasUntouchedExamples(elements)` answers whether to offer either, cached per elements array in a `WeakMap`, so a
  render or a chrome-store read between commits costs one lookup. `untouchedExampleCount` counts them.

## The tray

`TemplateExampleTray` (`packages/workbench/src/components/chrome/PaletteTray.tsx`, beside the palette tray it hangs
as) draws a standing palette tray: the sparkles glyph, "Example content shows how this works.", **Clear Example
Content** (the brand-toned `PaletteTrayAction`) and **Keep It**. It steps aside while a mode's message takes the
slot (`data-yields-to-mode`). Without a strip (the floating palette, Draw's dock) it is the same card at the top centre, placed clear of Draw's dock (`pillPlace`, shared with StartAgainTray).
Below `sm` the sentence is screen-reader only, so the two actions fit the strip's width.

Each editor mounts it from `components/start/ExampleContentTray.tsx` (inside `EditorStartPanels`), shown when the
editor is hydrated, not read-only (an Editor: a Participant and a Viewer are read-only to the editor's structure),
not zen or an embed, the tab is not locked, livediagram's Watch It Built demo is not playing, and
`hasUntouchedExamples(activeTab.elements)`. livedocuments reads that one answer off its chrome store. Its actions are
the editor's `clearExampleContent` and `keepExampleContent` (useTemplateFlow), each announcing what it did and sending
`Template · Changed · ExampleCleared` or `ExampleKept` (charted as Template Examples in each product's Look & Feel
stack on the telemetry site).

## Performance

Marking runs once per template landed (a few dozen elements). `hasUntouchedExamples` hashes only marked elements and
answers from its cache between commits; a test holds 5,000 marked notes to a CPU-time budget for counting and clearing.
