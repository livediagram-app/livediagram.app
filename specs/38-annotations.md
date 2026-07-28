# 38 — Annotations

A lightweight way to pin an explanatory note to a spot on the canvas without
cluttering it: a small themed circle holding a fixed note glyph. Hover it to
read its note floating above everything; click it to edit the note.

Annotations are a first-class element type. They build on the existing
per-element **note** feature (`note?: string` on every boxed element, edited
through `NotePopover` / `useEditorNotes`, see [spec/09](09-canvas-and-palette.md));
an annotation is just the dedicated, palette-addable element whose entire
purpose is to carry one. The note is a small **rich-text** document as of
[spec/92](92-rich-text-notes.md) — formatting lives in `noteRich?: TextRun[]`
and `note` stays the plain-text mirror, so everything below is unchanged.

## What it is

- **Visual:** a fixed-size circle (~44 px), themed like a shape (fill +
  stroke from the active theme), with a single **note glyph** centred inside,
  tinted by the stroke colour. There is no inline label — the content lives in
  the note.
- **Fixed marker, not a box.** The circle does not resize: no corner / rotate
  handles. You can still move it (drag), recolour it (Colours accordion),
  re-layer it (bring to front / send to back), lock it, group it, link it, and
  delete it like any other element. It keeps a consistent marker size so a
  canvas full of annotations stays tidy.
- **Glyph is fixed.** Every annotation shows the same note marker glyph; it
  is not per-annotation pickable (keeps them visually uniform).

## Adding one

- **Tools tab** of the palette has an **Annotation** button. Clicking
  it drops a new annotation at the viewport centre (instant-drop, no
  draw-to-size — like Table / Icon), selects it, and is one undoable commit.
- New annotations inherit the active theme's colours via the same
  `deriveNewBoxedColours` path every palette add uses, so they match the
  diagram out of the box.

## Interaction

- **Hover → read.** Pointer-entering an annotation that has note text floats a
  read-only preview of the note in a portal **above every canvas element**
  (rendered by `NoteRichText`, so headings / lists / links read the same as
  they do in the popover — spec/92), so the note is legible even when other
  elements are painted on top of the annotation. The preview disappears on
  pointer-leave. An annotation with no note yet shows nothing on hover. The
  hover preview is suppressed while the annotation is selected (the click /
  edit popover owns that surface).
- **Click → edit.** A plain click on an annotation opens the editable
  `NotePopover` (same component the note badge opens elsewhere). Typing +
  commit goes through history like any other element edit. Clicking the same
  annotation again toggles the popover closed. Dragging moves it instead of
  opening the editor (a click that doesn't move opens; a drag doesn't).
- **Read-only viewers** (view-role share visitors) can hover to read and open
  the note read-only, but can't edit, move, or delete it — same gating as
  every other element.

## Model

`AnnotationElement` is a boxed element (`type: 'annotation'`), so it flows
through every generic boxed path (selection, drag, layering, lock, group,
link, colours, comments, the note feature). It carries the shared boxed
fields plus `note?: string` (and `noteRich?: TextRun[]`, spec/92). `createAnnotation(x, y)` (in
`packages/diagram/src/factories.ts`) returns one at the default 44×44 marker
size. `isBoxed` and the `BoxedElement` union include it.

- **Sizing:** `inheritedSizeFor` keeps an annotation at its intrinsic marker
  size regardless of the current selection (it does not inherit a selected
  element's dimensions the way a shape would).
- **Colours / theme:** annotation themes its `fillColor` (circle) and
  `strokeColor` (ring + glyph) via `THEME_COLOUR_FIELDS`, exactly like a
  shape's fill + stroke; it has no themed text (the note is plain). The
  per-type colour defaults live in `packages/diagram/src/colors.ts`
  (`defaultFillColor` / `defaultStrokeColor` / `defaultTextColor` /
  `defaultPadding`) and `supportsColours` returns true for it.
- **Controls hidden:** the Shape morph grid, Border accordion, and aspect-lock
  are hidden (an annotation isn't a morphable box) — this falls out of those
  controls being gated on `type === 'shape'`. The Colours accordion (fill +
  stroke) and the Layer controls apply.

## Persistence / export

- Persists like any element; the wire format treats element `type` as an open
  string, so no schema change is required.
- **Visual exports** (PNG / SVG) render an annotation as its themed circle
  (the note text is not drawn — it's a hover affordance, not page content).
- **Markdown export** lists a labelled annotation under Elements with an
  `(annotation)` tag via the existing `isBoxed`-driven path.

## Telemetry

Adding an annotation emits `track('Element', 'Added', 'Annotation')`; opening
its note reuses the existing `track('Note', 'Opened')` from `useEditorNotes`
(see [spec/22](22-telemetry.md)).
