# Annotations: blueprint

Derived from [Annotations](../annotations.md). The note it carries is specified in
[Rich-text notes](../rich-text-notes.md) and blueprinted in [rich-text-notes.md](rich-text-notes.md).
The spec decides; this file only adds engineering precision. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `DDn`.

Scope, by file:

| File                                                     | Role                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/diagram/src/element-types.ts`                  | `AnnotationElement`                                               |
| `packages/diagram/src/index.ts`                          | `isBoxed` and the `BoxedElement` union include `'annotation'`     |
| `packages/diagram/src/factories.ts`                      | `createAnnotation`, `ANNOTATION_SIZE`                             |
| `packages/diagram/src/colors.ts`                         | Per-type colour and padding defaults; `supportsColours`           |
| `packages/diagram/src/themes.ts`                         | `THEME_COLOUR_FIELDS.annotation`: fill + stroke                   |
| `packages/diagram/src/svg-render-describe.ts`            | Export shape: an ellipse                                          |
| `apps/live/lib/canvas.ts`                                | `inheritedSizeFor` keeps the marker size                          |
| `apps/live/lib/canvas-selection.ts`                      | No quick-connect plus on an annotation                            |
| `apps/live/lib/themes.ts`                                | `deriveNewBoxedColours` treats an annotation like a shape         |
| `apps/live/lib/draw-mode.ts`                             | Annotation is absent from draw-to-size                            |
| `apps/live/app/diagram/[id]/useElementCreation.ts`       | `addAnnotation`: viewport-centre drop + telemetry                 |
| `apps/live/components/palette/palette-tile-defs.tsx`     | Tile `tools:annotation`, `toolGroup: 'write'`                     |
| `apps/live/components/palette/PaletteTileGrid.tsx`       | Routes the tile to `addAnnotation`, never arms a draw             |
| `apps/live/components/canvas/element-variant.ts`         | The round, bordered wrapper style                                 |
| `apps/live/components/canvas/ElementFaceRouter.tsx`      | Renders `AnnotationGlyph` as the face                             |
| `apps/live/components/canvas/AnnotationMarker.tsx`       | `AnnotationGlyph`, `AnnotationHoverNote`                          |
| `apps/live/components/canvas/BoxedElementView.tsx`       | Hover state, preview gate, badge suppression                      |
| `apps/live/components/canvas/useBoxedElementGestures.ts` | Double-click opens the note [Q9]                                  |
| `apps/live/components/canvas/element-parts.tsx`          | `SelectionChromeLayer`: resize handles for a selected marker [Q8] |
| `apps/live/components/palette/EditorContextMenu.tsx`     | Size section shown, Rotation hidden for an annotation [Q8]        |
| `apps/live/lib/export-tab-text.ts`                       | Markdown outline [Q11]                                            |

## Domain and naming

| Term          | Identifier                                | Meaning                                            |
| ------------- | ----------------------------------------- | -------------------------------------------------- |
| Annotation    | `AnnotationElement`, `type: 'annotation'` | A boxed marker whose purpose is to carry a note    |
| Marker size   | `ANNOTATION_SIZE` (`44`)                  | Width and height of a new annotation               |
| Note glyph    | `AnnotationGlyph`                         | The fixed speech-bubble icon, tinted by the stroke |
| Hover preview | `AnnotationHoverNote`                     | Read-only note floating above the canvas on hover  |
| Note popover  | `NotePopover`                             | The shared editor; see the notes blueprint         |

Banned synonyms: "pin" (a comment pin is another element), "marker note", "callout" (a web
component), "tooltip" for the hover preview.

## Behaviour and state

### Add

1. The Write tile `tools:annotation` calls `addAnnotation` directly; it never arms draw mode
   (`draw-mode.ts` leaves it out).
2. `addAnnotation` returns early when `editsBlocked`. Otherwise `addBoxed` places
   `createAnnotation(x, y)` centred on the viewport, with `deriveNewBoxedColours` applied, selects
   it, and commits once (one undo step).
3. `track('Element', 'Added', 'Annotation')`.
4. A new annotation is `44 × 44` and `aspectLocked: true` (DD, see Constants); `inheritedSizeFor`
   returns its own size whatever is selected.

### Hover

States per marker: `hovering` (local `useState`), `isSelected`, `isEditing`.

- `pointerenter` sets `hovering`; `pointerleave` clears it.
- The preview renders when `hovering && !isSelected && !isEditing && element.note`.
- Escape dismisses a showing preview until the next `pointerenter` [Q10].
- The preview stays while the pointer moves onto it and for a short grace period after leaving the
  marker [Q10].

### Open the note

- A double-click on an annotation calls `onOpenNote(id)` (unless `isEditing` or remotely locked),
  which toggles `noteOpenId` [Q9]. A single click selects; a press-and-drag moves.
- A read-only viewer's double-click opens the popover `readOnly`.
- The generic note badge is suppressed on an annotation: the marker is the affordance.

### Resize and rotate

- A selected annotation shows corner resize handles and keeps its aspect lock, so it stays round
  [Q8].
- The Size section (width, height, aspect lock) applies; Rotation is hidden for annotations [Q8].
- Shape morph grid and Border are hidden: both gate on `type === 'shape'` / `supportsBorder`.

### Everything else

Move, recolour (Colours accordion), layer, lock, link, comment, assign an action and delete follow
the generic boxed paths. No quick-connect plus appears (`showPlus` excludes annotations) [Q11].

Invariants:

- **I1:** an annotation has no inline label editor; `elementHasText` is false for it.
- **I2:** a new annotation is 44 × 44 regardless of the selection.
- **I3:** the hover preview never shows on a selected or editing marker, nor for an empty note.

## Interfaces and contracts

```ts
// packages/diagram/src/element-types.ts (abridged)
export type AnnotationElement = {
  id: ElementId;
  type: 'annotation';
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  note?: string;
  noteRich?: TextRun[];
  fillColor?: string; // circle
  strokeColor?: string; // ring + glyph
  textColor?: string; // declared, unused
  label?: string; // declared, no UI sets it
  locked?: boolean;
  link?: ElementLink;
  commentThread?: CommentThread;
  action?: ElementAction;
  rotation?: number;
  aspectLocked?: boolean;
  // …remaining shared boxed fields, declared for the union paths
};

// packages/diagram/src/factories.ts
export function createAnnotation(x: number, y: number): AnnotationElement;

// apps/live/components/canvas/AnnotationMarker.tsx
export function AnnotationGlyph(props: { stroke: string }): JSX.Element;
export function AnnotationHoverNote(props: {
  elementId: string;
  note: string;
  noteRich?: TextRun[];
}): JSX.Element | null;
```

`validate.ts` accepts `'annotation'` in its type vocabulary and requires no extra field. The wire
format treats `type` as an open string.

## Data and persistence

- **Persisted:** the boxed fields plus `note` / `noteRich`, in the tab JSON.
- **Never persisted:** `hovering`, the preview position.
- **Migration:** none.
- **Visual export:** an ellipse in the element's fill and stroke; no glyph, no note (DD13) [Q11].
- **Markdown export:** listed under Elements with `(annotation)` only when `label` is set, which no
  editor path does [Q11].
- **Excalidraw export:** an ellipse (`excalidraw-export.ts:147`), without the note.

## Errors and edge cases

| #   | Case                                        | Handling                                            |
| --- | ------------------------------------------- | --------------------------------------------------- |
| E1  | Add while edits are blocked                 | `addAnnotation` returns; nothing tracked            |
| E2  | Hover with no note                          | No preview                                          |
| E3  | Marker near the top of the viewport         | Preview flips below when `rect.top - GAP < 120`     |
| E4  | Marker near a side edge                     | Preview centre clamped by `MAX_W / 2 + EDGE_MARGIN` |
| E5  | Long note                                   | Preview clipped at 15rem with a fade [Q10]          |
| E6  | Marker removed from the DOM while hovered   | Position not updated; unmounts with the element     |
| E7  | Remotely locked marker double-clicked       | Ignored                                             |
| E8  | Resized far from 44                         | Allowed, aspect kept [Q8]; new markers are still 44 |
| E9  | Annotation dropped on a shape via icon fold | Not an icon; `acceptsInlineIcon` is shape-only      |

## Security and trust

The preview and popover render through `NoteRichText`: no markup, links re-checked with
`isSafeFollowUrl`. See the notes blueprint. The preview container is `pointer-events-none` apart
from links, so it cannot capture canvas gestures.

## Performance and limits

- One `useState` per boxed element for `hovering`; the preview mounts only while shown.
- The preview re-anchors on `resize` and capture-phase `scroll`, `O(1)` per event.

## Presentation and UX

- Marker: a circle (`borderRadius: 50%`), 2px solid border in the stroke, `shadow-sm`, glyph at 58%
  of the box tinted by the stroke.
- Colours (DD14): light fill `#e0f2fe`, stroke `#0ea5e9`; dark fill `#3a3a44`, stroke `#a1a1aa`;
  padding `none`. A theme sets fill and stroke only.
- Preview (DD12): portal, `z-[var(--z-toast)]`, white / slate-900 card, `max-w` 280px, `max-h-60`,
  above the marker with a 10px gap, below when too close to the top.
- Tile: caption from the tile, description "Annotation. A note marker: hover to read it,
  double-click to edit." [Q9]
- No loading or error state.

## Accessibility

- Glyph `aria-hidden`; the element's name comes from `elementKindLabel` ("Annotation").
- Hover preview meets WCAG 2.2 SC 1.4.13: dismissible (Escape), hoverable, persistent until the
  pointer leaves both [Q10].
- Keyboard: the command palette's `note` command opens the note for the selected annotation.
- Contrast: glyph `#0ea5e9` on `#e0f2fe` is a non-text graphic above 3:1; dark `#a1a1aa` on
  `#3a3a44` likewise.
- Motion: none.

## Web experience

- **CLS.** The preview is `position: fixed` in a portal; it moves nothing.
- **INP.** Hover toggles one boolean on one element view.

## Observability

The code emits no log here (G1). Target fingerprint:

| #   | Where                         | Level           | Fingerprint                                     |
| --- | ----------------------------- | --------------- | ----------------------------------------------- |
| O1  | `addAnnotation` while blocked | `console.debug` | `[annotation] add skipped reason=edits-blocked` |

Telemetry: `Element` / `Added` / `Annotation`; opening reuses `Note` / `Opened`.

## Testing

| Rule                                           | Test                                           | File                                                          |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| New marker is 44 × 44, no note                 | `createAnnotation is a 44x44 boxed marker`     | `packages/diagram/src/factories.test.ts`                      |
| Keeps marker size regardless of selection (I2) | `keeps an annotation at its fixed marker size` | `apps/live/lib/canvas.test.ts`                                |
| No quick-connect plus                          | `showPlus` false for an annotation             | `apps/live/lib/canvas-selection.test.ts`                      |
| Telemetry token `Annotation`                   | `elementTelemetryType`                         | `apps/live/lib/element-telemetry.test.ts`                     |
| Tile routes to an action                       | palette telemetry coverage                     | `apps/live/lib/palette-telemetry-coverage.test.ts`            |
| No inline text (I1)                            | `elementHasText` false for annotation          | `packages/diagram/src/element-has-text.test.ts`               |
| No shadow; arrows do not hide behind it        | shadow / arrow-behind exclusions               | `packages/diagram/src/shadow.test.ts`, `arrow-behind.test.ts` |
| Themes fill + stroke, not text                 | none                                           | (G7)                                                          |
| `supportsColours` true                         | none                                           | (G7)                                                          |
| Hover preview gate (I3), flip, Escape [Q10]    | none                                           | (G7)                                                          |
| Double-click opens, read-only opens read-only  | none                                           | (G7)                                                          |
| Export draws an ellipse                        | none                                           | (G7)                                                          |
| Rotation hidden, aspect kept on resize [Q8]    | none                                           | (G7)                                                          |

## Constants and configuration

| Name                      | Value                      | Provenance / safe range                 | Home                       |
| ------------------------- | -------------------------- | --------------------------------------- | -------------------------- |
| `ANNOTATION_SIZE`         | `44`                       | Spec "~44 px"; 32 to 56                 | `factories.ts`             |
| `GAP`                     | `10`                       | Marker to preview, px; 6 to 16          | `AnnotationMarker.tsx`     |
| `MAX_W`                   | `280`                      | Preview width cap, px; 240 to 360       | `AnnotationMarker.tsx`     |
| Flip threshold            | `120`                      | Space needed above, px (inline literal) | `AnnotationMarker.tsx`     |
| Preview max height        | `max-h-60` (15rem)         | DD12                                    | `AnnotationMarker.tsx`     |
| Glyph size                | `58%` of the marker        | Reads at 44px; 50% to 66%               | `AnnotationMarker.tsx`     |
| `DARK_INK.annotationFill` | `#3a3a44`                  | One step above the dark shape fill      | `colors.ts`                |
| `EDGE_MARGIN`             | `VIEWPORT_EDGE_MARGIN` = 8 | Shared popover margin                   | `lib/clamp-to-viewport.ts` |
