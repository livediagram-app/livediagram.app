# Template example content

Derived from [architecture.md](../architecture.md) "The shared element model" (Work Tracker 1181). Each product's own
spec says what its people see: livediagram's and livedocuments' `docs/specs/006-document/template-examples.md`,
livedesign's `docs/specs/006-design/template-examples.md`. liveplanner's example cards are its own
(`liveplanner/docs/specs/026-plan/plan-templates.md` "Example cards") and this module is their counterpart for canvas
elements.

## What is an example value

`exampleValuesOf(el)` (`packages/element-model/src/template-example.ts`) reads, by kind:

| Element                                 | Example values                                       | Kept as structure                                            |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `sticky`                                | its text (`label`, with `richText` its mirror)       | colour, size, place                                          |
| a `shape` with `checklistItems`         | every row's text and tick                            | the number of rows, the card                                 |
| `table`                                 | every body cell (outside `headerRow`/`headerColumn`) | header row, header column, cell looks                        |
| a `shape` with `pieSlices`/`lineSeries` | the numbers                                          | slice and series names, categories, look                     |
| a `text` its template names as sample   | its words (`label`, with `richText` its mirror)      | its box, size, weight, colour, place                         |
| anything else                           | none                                                 | all of it (headings, shape labels, lanes, the template note) |

An element whose values are all empty (a blank sticky, an empty table body, a zeroed chart) holds none.

Free text is an example only when its template says so (Work Tracker 1196). `markTemplateExamples(elements,
isExampleText)` takes the template's rule, a predicate over its `text` elements; without one no text is marked. Each
product's templates package answers `templateExampleText(kind)`:

- **livedocuments and livedesign**: `isSampleCopy` (this module) for every template but livedesign's logo templates
  (`logo-design`, `logo-lockups`, `logo-wordmarks`, `logo-emblems`, `logo-marks`), whose words are the mark itself.
- **livediagram**: a board's free text is its structure (the guide line, prompts, keys and legends, column titles),
  so a template opts its sample copy in by its words: the Fishbone's causes, the Timeline's milestone lines, the
  Roadmap's outcomes and the Venn's tested ideas, each the builder's own data (`*_SAMPLE_COPY`).

`isSampleCopy(el)` is body copy and sample sentences, never a title or a heading: a `text` whose words are not bold
(no `textBold`, no `fontWeight` of 600 or more, not every rich run bold), carry no wordmark type (`hasWordmarkType`:
tracking, weight, case or arc), draw at a body size (their size times any `textScale`, at most the model's 48 px), and hold
at least two words with a letter in them (so a page number, a price or a one-word nav label stays). The check walks
the words once, left to right, with no regular expression over the whole label.

An emptied text draws a faint prompt for an Editor (below), so a cleared template never leaves invisible boxes.

## The mark

`markTemplateExamples(elements, isExampleText?)` stamps every element holding example values (a `text` only when
`isExampleText` says so) with `templateExample`: an FNV-1a hash
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

- `clearTemplateExamples(elements)` empties every untouched, unlocked example (a sticky's or a text's words and runs, a
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
The Pages editors frame a page below it while it shows: `topStripInset` (`packages/workbench/src/lib/top-strip-inset.ts`,
shared by livedocuments and livedesign, and by their Fit to Screen in `lib/tab-fit-view.ts`) reaches down to a standing
tray (`data-palette-tray` with `data-yields-to-mode`), under the strip or as the pill, so the page's header is never under
it. While the tray yields to a mode's message (the modifier hint as Shift+1 is pressed), that message's box counts
instead; with no standing tray a mode's passing message gets no room. The snap as the view rests (`usePageSnap`) measures
with `settling`, which keeps the tray's room the page was framed with once the tray goes, so Clear Example Content and
Keep It never move the page; the next explicit frame (Fit, Shift+1, a page's label, landing) takes the room back.

Each editor mounts it from `components/start/ExampleContentTray.tsx` (inside `EditorStartPanels`), shown when the
editor is hydrated, not read-only (an Editor: a Participant and a Viewer are read-only to the editor's structure),
not zen or an embed, the tab is not locked, livediagram's Watch It Built demo is not playing, and
`hasUntouchedExamples(activeTab.elements)`. livedocuments reads that one answer off its chrome store. Its actions are
the editor's `clearExampleContent` and `keepExampleContent` (useTemplateFlow), each announcing what it did and sending
`Template · Changed · ExampleCleared` or `ExampleKept` (charted as Template Examples in each product's Look & Feel
stack on the telemetry site).

## The empty text prompt

A `text` with no words (after Clear Example Content, or any text emptied) draws a faint **"Text"** where its words
would be, the word its editor shows while typing into it, so double-clicking it never moves anything. It is drawn by
`EmptyTextPrompt` (`packages/workbench/src/components/canvas/EmptyTextPrompt.tsx`), from each editor's `renderLabel`
when the label is blank, the element is not being edited and does not hug its text (a whiteboard text box keeps no
prompt), and `emptyPrompt` is on: an Editor's session (`!readOnly`), the tab and the element not locked. A Participant
and a Viewer, an embed and a locked tab see nothing there, as before.

It is the canvas's own chrome, never content: it is `aria-hidden`, takes no pointer (the element under it still takes
the double-click), and stores nothing. The image, vector and PDF exports draw from the elements, not the canvas, so
they never see it; livedocuments' animated GIF, which snapshots the canvas, drops it (`data-gif-omit`). It is drawn in
the element's own ink at 35% opacity, its size the text's size (a `scale` text's at the Small preset's px), aligned as
the text is.

It costs nothing for a text with words: `renderLabel` checks the label is blank before anything else in that branch.

## Performance

Marking runs once per template landed (a few dozen elements). `hasUntouchedExamples` hashes only marked elements and
answers from its cache between commits; a test holds 5,000 marked notes to a CPU-time budget for counting and clearing.
