# Text boxes: blueprint

Derived from [Whiteboard](../whiteboard.md) "Text boxes". The spec decides; this file adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Tn`.

Scope, by file:

| File                                                    | Role                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/document/src/element-types.ts`                | `TextElement.sizing`, `TextElement.textScale`                                            |
| `packages/document/src/validate.ts`                     | `TEXT_SCALE_MIN`, `TEXT_SCALE_MAX`; the two fields' checks                               |
| `packages/document/src/svg-render-describe.ts`          | An export draws a text box's label at its scale                                          |
| `apps/api/src/openapi/schemas.generated.ts`             | Regenerated: the two fields on `TextElement`                                             |
| `apps/live/lib/text-hug.ts`                             | Pure geometry: padding, font px, hug size, placement, commit, resize                     |
| `apps/live/components/canvas/text-hug-measure.ts`       | The DOM measurer: `measureTextHug`, `measureDrawnText`, `labelRuns`                      |
| `apps/live/components/canvas/useTextHug.ts`             | The element view's live size while typing                                                |
| `apps/live/components/canvas/BoxedElementView.tsx`      | Draws the live size; hands `TextHugLabel` to `renderLabel`                               |
| `apps/live/components/canvas/element-labels.tsx`        | `renderLabel(..., hug)`: padding, no placeholder, fixed px for `scale`, the scale        |
| `apps/live/components/canvas/element-label-views.tsx`   | `FixedSizeLabel` takes `px`; `RichLabel` takes `textScale`; padding may be CSS           |
| `apps/live/components/canvas/label-style.ts`            | `labelBasePx`, `labelRunPx`, `LabelPadding`                                              |
| `apps/live/components/canvas/RichTextEditor*.ts(x)`     | `textScale`, `onLiveText`                                                                |
| `apps/live/components/canvas/useRichTextSession.ts`     | Scaled px; reports the editor node after every change                                    |
| `apps/live/components/rich-text/useRichTextDocument.ts` | Re-sets the caret when an Enter at the end opens the empty last line                     |
| `apps/live/components/rich-text/rich-text-dom.ts`       | `reconcileTrailingNewline` says whether it added the line; `reassertSelection`           |
| `apps/live/lib/draw-commit.ts`                          | `buildDrawnBoxed` places a whiteboard text box through `placedTextBox`                   |
| `apps/live/app/document/[id]/useSelectionEditing.ts`    | `commitLabel` hugs or removes, in the label's one commit                                 |
| `apps/live/hooks/canvas/boxed-drag-resolve.ts`          | `resizedElement`, `TextHugResize`                                                        |
| `apps/live/hooks/canvas/useEditorDrag.ts`               | A lone whiteboard text box resizes through `resizedElement`                              |
| `apps/live/hooks/canvas/useTextStyleSetters.ts`         | Size, font, bold, italic, underline, strikethrough re-hug; a picked size drops the scale |
| `apps/live/hooks/canvas/useElementStyle.ts`             | Passes `activeTab` to the text setters                                                   |
| `apps/live/hooks/canvas/useEditModeContextMenu.ts`      | No element menu beside a whiteboard text box being typed into (T4)                       |
| `apps/live/components/canvas/EditorCanvasHost.tsx`      | Passes `whiteboard` to `useEditModeContextMenu`                                          |

## Domain and naming

| Term             | Identifier                 | Meaning                                                                                                                 |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Hugging text box | `hugsText(el, whiteboard)` | A `text` element on a whiteboard                                                                                        |
| Sizing           | `TextElement.sizing`       | `fit`: the width follows the text up to the wrap width; `wrap`: the width is set; absent: a fixed box that does not hug |
| Text scale       | `TextElement.textScale`    | Multiplier on the label px, from a Shift resize; absent: 1                                                              |
| Hug padding      | `textHugPadding(el)`       | `{ x: 4, y: 2 }`, or the element's padding preset on every side (T2)                                                    |
| Text block       | `MeasureTextBlock`         | The text's own laid-out size at a width, padding excluded                                                               |
| Hug size         | `hugTextSize(el, measure)` | The box around a text block                                                                                             |

"Hug" is the one verb; "fit" stays the sticky's auto-fit, "auto-size" is not used.

## Behaviour and state

### Font px and padding

- `textHugFontPx(el) = LABEL_FONT_PX[el.textSize ?? 'scale'] * (el.textScale ?? 1)`. A hugging box
  draws `scale` at its fixed 16 px through `FixedSizeLabel`, never the SVG fit (`ScalingLabel`),
  which is what the editor already uses.
- Label and editor padding: `textHugPaddingCss(el)`, `"2px 4px"` by default.
- Typography, display, editor and measurer alike: weight 500, line height `TEXT_HUG_LEADING` 1.25,
  `white-space: pre-wrap`, `overflow-wrap: break-word`.

### Hug size (`hugTextSize`)

- Auto width: measure at natural width capped at `TEXT_HUG_MAX_WIDTH - 2 * pad.x` (472 px);
  `width = ceil(block.width) + 2 * pad.x`, `height = ceil(block.height) + 2 * pad.y`.
- Set width: measure at exactly `max(1, width - 2 * pad.x)`; the width stays,
  `height = ceil(block.height) + 2 * pad.y`.
- Whole px, rounded up, so a word never wraps early in the drawn box (at most 1 px over the text).

### Placement (`placedTextBox`, from `buildDrawnBoxed`)

- Line height `h = ceil(textHugFontPx * 1.25) + 2 * pad.y` (22 px at the default 14 px).
- Tap: `label ''`, `sizing: 'fit'`, `x = tapX - pad.x`, `y = tapY - h / 2`, `width = 2 * pad.x`,
  `height = h`.
- Drag: `label ''`, `sizing: 'wrap'`, the dragged box's `x`, `y` and `width`, `height = h`.
- Either opens for typing (`opensForTyping`). No placeholder is shown: the caret is the box.
- Diagram tabs: unchanged (`createText`'s 220 × 64 and "Text").

### Typing

- `useRichTextSession` runs a layout effect on `[liveText, active]` that calls
  `onLiveText(editorNode)`; `useTextHug` measures a copy of the editor's nodes (`measureTextHug`)
  and holds the size in view state. `BoxedElementView` draws `textHug.box` in place of the stored
  size while editing. Nothing is written to the document per keystroke.
- An empty editor measures one line (a zero-width space): the box is `8 × 22`.
- A copy of the editor's nodes carries what the browser left in it (a held-open empty line after
  Enter, a stray `<br>`), so the box follows what shows.
- Enter at the very end: `syncFromDom` adds the render-only trailing `<br>` and, when it did,
  re-sets the selection (`reassertSelection`); WebKit had settled the caret before the newline.

### Commit (`commitLabel`)

- One `commit`: the label (and runs) and, for a hugging box, `hugCommittedText` in the same map.
- `label.trim() === ''`: the element is removed, the selection cleared, `[text-hug] removed an
empty text box <id>` logged.
- A label and runs identical to the stored ones: the box is left as it is (an existing box keeps
  its size until edited).
- Otherwise the box takes `hugTextSize` measured from its runs (`measureDrawnText(tab.font)`).

### Resize (`resizedElement` in the resize frame)

Only for a single hugging element, unrotated (T3). `constrain = drag.aspectLocked || shift`.

- Plain, a handle with `e` or `w`: `sizing` set to `wrap`, the frame's `x` and `width` taken, the
  height hugs. Top and bottom handles leave the width (and an auto width) alone; the height hugs.
- The edge the handle does not move stays: the bottom for an `n` handle, else the top.
- Shift: `textScale' = clamp(textScale * (next.width - 2 pad.x) / (current.width - 2 pad.x))` to
  `[TEXT_SCALE_MIN, TEXT_SCALE_MAX]`, relative to the previous frame so frames never drift; the
  frame's `x` and `width`; the height hugs the scaled text at that width. The anchor: bottom for
  `n`, top for `s`, else the middle. `sizing` is kept. The text keeps its ratio exactly; the
  4 / 2 px padding does not scale, so the box's ratio moves by the padding alone (T5).
- One gesture is one history step (the drag's checkpoint).

### Style changes

`setTextSizeSelected`, `setFontSelected` and `toggleTextStyleSelected` commit through
`commitHugging`: every hugging member of the selection re-hugs in the same commit. A picked size
drops `textScale` on a text box (any tab).

## Interfaces and contracts

```ts
export type MeasureTextBlock = (width: number, fixed: boolean) => BlockSize;
export function hugsText(el: Element, whiteboard: boolean): el is TextElement;
export function hugTextSize(el: TextElement, measure: MeasureTextBlock): BlockSize;
export function placedTextBox(
  el,
  tap,
  start,
  drag,
): Pick<TextElement, 'x' | 'y' | 'width' | 'height' | 'label' | 'sizing'>;
export function hugCommittedText(
  el: TextElement,
  measure: (el: TextElement) => MeasureTextBlock,
): TextElement | null;
export function hugResizedText(current, next, mode, constrain, measure): TextElement;
export function measureTextHug(
  el: TextElement,
  content: TextRun[] | HTMLElement,
  fontFamily?: string,
): MeasureTextBlock;
export function measureDrawnText(
  tabFont: string | undefined,
): (el: TextElement) => MeasureTextBlock;
export function resizedElement(
  el: BoxedElement,
  next: ShapeBounds,
  hug: TextHugResize | null,
): BoxedElement;
```

`renderLabel` gains a trailing `hug?: TextHugLabel` (`{ padding, fontPx, onLiveText }`).

## Data and persistence

- `sizing?: TextSizing` (`fit` | `wrap`), `textScale?: number` on `TextElement`: optional, absent on every existing
  document, so no migration. An existing box keeps its stored size until an edit changes its
  label, a style change re-hugs it or a handle resizes it; with `wrap` it keeps its width
  and its height hugs (T1).
- `validate.ts` refuses a `sizing` other than `fit` or `wrap` and a `textScale` outside `[0.1, 40]`.

## Errors and edge cases

- Empty or whitespace-only on commit: removed (above). Undo brings the empty box back, one step.
- A word longer than the wrap width breaks inside the word (`overflow-wrap: break-word`).
- Rotated box, multi-selection resize: the frame's bounds as on any tab (T3).
- Diagram tab: no hug anywhere (`hugsText` is false).
- An explicit padding preset: that padding on every side (T2).

## Security and trust

The two fields are bounded by `validate.ts`; a scale is clamped when a resize makes it.

## Performance and limits

One off-screen measurer node (`[data-text-hug-measurer]`), reused. Per keystroke: one layout of a
copy of the editor's nodes; per resize frame: one layout. Both well under a frame.

## Presentation and UX

- No placeholder on a hugging box; no element menu opened beside it while typing (T4). The rich
  text toolbar still rides above it.
- The selection ring and handles follow the box, so they sit just round the words.

## Accessibility

- The editor stays the labelled `role="textbox"` ("Edit text"), focused on placement; the box
  growing moves neither focus nor caret. The element keeps its `role="img"` name
  (`Text "..."`). Colours and contrast are the board ink's, unchanged.
- Nothing animates: the box changes size in the frame the text does.

## Web Experience

- CLS: the box grows inside the canvas's transformed layer, never shifting page layout.
- INP: one off-screen layout per keystroke, measured before paint in a layout effect.
- LCP: untouched (no new assets).

## Observability

- `[text-hug] removed an empty text box <id>` (debug) when a commit removes one.

## Testing

| Rule                                                  | Test                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| Padding, font px, hug size, wrap at 480               | `apps/live/lib/text-hug.test.ts`                                     |
| Placement: tap caret-sized, drag width, one line      | `apps/live/lib/draw-commit.test.ts`, `text-hug.test.ts`              |
| Commit hugs; empty removed; set width kept            | `apps/live/lib/text-hug.test.ts` (`hugCommittedText`)                |
| Resize: width set, height hugs, anchors, Shift scale  | `text-hug.test.ts`, `hooks/canvas/boxed-drag-resolve.resize.test.ts` |
| Style changes re-hug; a picked size drops the scale   | `hooks/canvas/useTextStyleSetters.test.ts`                           |
| No menu beside a whiteboard text box being typed into | `hooks/canvas/useEditModeContextMenu.test.tsx`                       |
| The measurer's layout inputs                          | `components/canvas/text-hug-measure.test.ts`                         |
| Enter at the end keeps the caret on the new line      | `components/rich-text/useRichTextDocument.test.tsx`                  |
| The fields' bounds                                    | `packages/document/src/validate.test.ts`                             |
| An export draws the scale                             | `packages/document/src/svg-render-fidelity.test.ts`                  |

Browser proof (Chromium and WebKit, dark and light, 100 % and zoomed): the box equals the text
rect plus the padding within 1 px at every step of place, type, Enter, delete back and commit.

## Constants and configuration

| Constant             | Value | Where                               | Provenance                  |
| -------------------- | ----- | ----------------------------------- | --------------------------- |
| `TEXT_HUG_PAD_X`     | 4     | `lib/text-hug.ts`                   | Spec                        |
| `TEXT_HUG_PAD_Y`     | 2     | `lib/text-hug.ts`                   | Spec                        |
| `TEXT_HUG_MAX_WIDTH` | 480   | `lib/text-hug.ts`                   | Spec                        |
| `TEXT_HUG_LEADING`   | 1.25  | `lib/text-hug.ts`                   | The label's `leading-tight` |
| `TEXT_SCALE_MIN`     | 0.1   | `packages/document/src/validate.ts` | T5: a 14 px label at 1.4 px |
| `TEXT_SCALE_MAX`     | 40    | `packages/document/src/validate.ts` | T5: a 14 px label at 560 px |

## Defaults ledger

T1 to T5 in [DEFAULTS.md](DEFAULTS.md).
