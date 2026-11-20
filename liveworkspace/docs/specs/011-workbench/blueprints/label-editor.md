# Label editor: blueprint

Derived from [label-editor.md](../label-editor.md). The spec decides; this file only adds engineering precision.
Paths are relative to the repository root.

Scope, by file (all under `packages/workbench/src/components/label-editor/`):

| File                          | Role                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `LabelEditor.tsx`             | The `contentEditable`, its handlers and the toolbar's frame; the product's toolbar is a render prop |
| `LabelEditor.types.ts`        | `LabelEditorProps`, `LabelEditorBinding`, `LabelToolbarProps`                                       |
| `useRichTextSession.ts`       | The label session: run style, auto-fit, mount caret, focus guards, commit lifecycle                 |
| `useLabelToolbarPlacement.ts` | The toolbar's flip below near the top and its slide back on screen at every edge                    |
| `useRichTextRuns.ts`          | The runs machine (was each product's `useRichTextDocument`, livedesign's `useRichTextDesign`)       |
| `useRichTextFormatActions.ts` | Command dispatch and the collapsed-caret scope rule                                                 |
| `rich-text-dom.ts`            | DOM read-back, selection offsets, `insertTextAtCaret`, the trailing newline                         |
| `rich-text-lines.ts`          | Mixed-direction text painted a line at a time, and the check that its lines are still apart         |
| `rich-text-format.ts`         | `ActiveFormat`, `computeActiveFormat`, `wordRangeAt`, `PLAIN_RUN_DEFAULTS`, `applyCss`              |
| `block-type.ts`               | `BlockType`, `BLOCK_TYPES`, `blockTypeOf`, `blockTypeApplies`, `listStyleOfText`                    |
| `label-style.ts`              | `effectiveRunStyle`, the label px tables, `labelTextStyleCss`, wordmark type, alignment             |
| `fit-multiline-text.ts`       | `fitMultilineFontPx`: the auto-fit of a multi-line label on Scale                                   |
| `text-hug-font.ts`            | `TEXT_HUG_LEADING`, `textHugFontPx`, `MeasureTextBlock`: what the measurer and the geometry share   |
| `text-hug-measure.ts`         | `createTextHugMeasure(runStyle)`, `labelRuns`, `drawnLabelFont`: the hug measurer                   |
| `plain-text-hug-measure.ts`   | the hug measurer bound to the plain run style, which every editor but livedocuments re-exports      |

Each product's binding, in all five editors (`apps/editor/…`, `apps/live/…` in livedesign):

| File                                    | What it binds                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/canvas/RichTextEditor.tsx`  | `<LabelEditor>` with its `RichTextToolbar`, its `track`, and livediagram's mind keys and Escape; liveplanner's and livehuddle's toolbars take no `element` |
| `components/canvas/label-style.ts`      | `export *` from the shared module; livedocuments overrides `effectiveRunStyle` with its effects                                                            |
| `components/canvas/text-hug-measure.ts` | `export *` from `plain-text-hug-measure.ts`; livedocuments binds `createTextHugMeasure` with its effects style; livediagram adds `measureDrawnMindLabel`   |
| `lib/text-hug.ts`                       | the text box's geometry, over `text-hug-font.ts`                                                                                                           |

Tests mock the bindings at their old paths (`vi.mock('@/components/canvas/text-hug-measure')`), so they keep them.

## Interfaces and contracts

```ts
// LabelEditor.types.ts
export type LabelEditorProps = {
  element: BoxedElement; // @liveworkspace/element-model/element: every product's own is assignable
  initialLabel: string;
  initialRuns?: TextRun[];
  placeholder: string;
  textSize: TextSize;
  fitBox?: { width: number; height: number; padding: number };
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: LabelPadding;
  textScale?: number;
  onLiveText?: (editor: HTMLElement) => void;
  fontFamily?: string;
  multiline: boolean;
  uppercase?: boolean;
  cursorAtEnd: boolean;
  textClassName?: string;
  inline?: boolean;
  maxLength?: number;
  onCommit: (label: string, runs: TextRun[]) => void;
  onCancel: () => void;
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void;
  onSetTextSize?: (size: TextSize) => void;
};

export type LabelEditorBinding = {
  renderToolbar: (toolbar: LabelToolbarProps) => ReactNode;
  trackFormat: (command: string) => void;
  runStyle?: (run: TextRun, el: BoxedElement, runSizePx: Record<RunSize, number>) => CSSProperties;
  useKeyDown?: (session: LabelKeySession) => (e: KeyboardEvent<HTMLDivElement>) => boolean;
  onEscape?: (commitNow: () => void) => void; // default: commitNow()
};
```

- `LabelToolbarProps` hands the toolbar the active format, the alignment, `onToggle`, `onPatch`, `onApplyList`,
  `onApplyHeading`, `onApplyTitleCaption`, `listStyle`, `onSetAlign` and the element: what every product's
  `RichTextToolbar` already took (livedocuments adds `onEffect` from `onPatch`).
- `useKeyDown` is a hook the binding names once (a module-level function), called on every render: livediagram's
  `useMindLabelKeys`. A `true` from its handler means the key was handled.
- The element type is element-model's structural `BoxedElement`; the shared code reads only `type`, `label`,
  `richText`, the whole-element text fields and a text box's wordmark fields.
- No `DOMParser`: the editor reads only `text/plain` from the clipboard, and paints with `createElement`.

## Behaviour and state

### Mixed-direction lines (`rich-text-lines.ts`)

- `labelEditorBidi(text)` (`lib/label-bidi.ts`) still decides: `'plaintext'` when the text holds a `'\n'` and a
  strong right-to-left letter. The editor no longer sets it as `unicode-bidi`: it is always `isolate`, with
  `dir="auto"`. `useRichTextRuns({ isolateLines: true })` (the label session) paints line by line when the rule says
  `'plaintext'`, and flat otherwise, as before. The note editor does not ask for it.
- Painted line by line, the editor's children are, in order: for each line with text, a line span
  (`data-rt-line`, `dir="auto"`, `unicode-bidi: isolate`) holding that line's run spans; for each newline, a run span
  holding just that `'\n'` with the attributes of the run it came from, outside any line span; then the trailing
  `<br>` sentinel when the text ends in a newline. Empty lines have no line span.
- Read-back is unchanged: a line span carries no run data, so it hands its children the attributes they already
  have, and the newline spans keep each `'\n'`'s attributes. The runs read back equal the runs painted, so opening
  and closing an editor commits nothing.
- After every input the session checks the structure in one pass over the editor's children
  (`linesStillApart(editor, text)`): line spans and newline spans alternate, each newline span holds only `'\n'`, no
  bare text sits at the top, and the newline spans hold every `'\n'` of the text. When it fails (Enter, Backspace
  joining lines, a paste over lines, a character typed into a newline span), or when the rule's answer changed
  (a first right-to-left letter, the last newline gone), the session paints again and puts the selection back at the
  same offsets. Typing within a line passes the check and paints nothing.
- Painted line by line, the editor's own `dir` follows the line holding the caret (`caretLineDirection`, read on
  every input and caret move: one `closest()` and the line's computed `direction`); a caret in no line keeps the
  last one, and a flat paint sets `dir="auto"` back. Without it the editor reads left to right (`dir="auto"` skips
  the line spans' own `dir`), and the caret at the end of a right-to-left line drew at its right. A caret moved up or
  down onto a line of the other direction can land at that line's other end from where `plaintext` put it.

### The toolbar's place (`useLabelToolbarPlacement.ts`)

- After every render, and on a scroll (captured, so a scroll inside the page counts) or a resize, one measure: the
  editor's top under `FLIP_BELOW_TOP` (52 px) sets `placeBelow`; then the toolbar's box with its caption
  (`measuredBox` from `useEdgeAwarePlacement`, the caption being the shared `FloatingTitle` with its
  `data-floating-title`) goes to `clampToViewport` with the slide in force, which works from the box's natural spot
  (the live rect less that slide) and answers the slide that keeps it 8 px (`VIEWPORT_EDGE_MARGIN`) inside
  `window.innerWidth` and `innerHeight`. A box with no size (not laid out) slides nothing. The slide is rounded to whole
  px and only changes when it moves by more than one: a slid box's rect comes back a few hundred-thousandths of a px
  off its slide, differently on each read, and an exact answer changed on every measure and rendered without end
  (React's update depth limit, seen at 450 px before it shipped). A measure that agrees renders nothing.
- `clampToViewport` keeps the start (left or top) of a box longer than the room inside, rather than its end: a fix for
  every caller, whose boxes are never that long but would have lost their first item.
- The slide is in screen px. `labelToolbarTransform(shift, zoom)` writes
  `translate(calc(-50% + x/zoom px), y/zoom px) scale(1/zoom)`: the translate comes before the counter-scale, in the
  editor's own units, where one unit is `zoom` screen px, so the slide is the same on screen at any zoom.

## Performance and limits

### Measured

Chromium (ego lite), a `contentEditable` 600 px wide in 14 px sans, four lines (Arabic, a 100,000-character Latin
line, Hebrew, Latin), one character inserted in the middle of the long line and the layout read back, median of
nine:

| Layout                                  | A keystroke's layout |
| --------------------------------------- | -------------------- |
| `plaintext` on the whole text (before)  | 23.5 ms              |
| `isolate` on the whole text (wrong ink) | 6.1 ms               |
| a line span per line (now)              | 5.9 ms               |

The line spans draw the same as `plaintext` on left and centre aligned text with mixed-direction lines, one of them
wrapping (compared by eye in the same page). In livediagram's editor, a text box and a sticky typed and pasted with
Arabic, Latin and Hebrew lines draw the same before and after, the caret at the end of the Hebrew line included.

First-load JS of each editor's document page (gzip of the scripts `placeholder.html` loads, production build):

| Editor        | Before     | After      |
| ------------- | ---------- | ---------- |
| livediagram   | 1493.0 KiB | 1490.4 KiB |
| livedesign    | 1319.1 KiB | 1318.6 KiB |
| livedocuments | 1215.3 KiB | 1214.2 KiB |

## Testing

- `rich-text-lines.test.ts`: the runs split into lines with each newline's attributes; the painted structure; a
  read-back of a painted text equals its runs; `linesStillApart` on a fresh paint, a joined line, a newline typed into
  a line, a character typed after a newline, and bare text; a CPU-time budget on checking 100,000 characters; the
  caret's line direction, and none for a caret outside every line.
- `LabelEditor.long-text.test.tsx`: long left-to-right text is one isolated run; right-to-left text that gains a
  second line is painted a line at a time and stays `isolate`; a keystroke in 100,000 characters stays inside its
  CPU-time budget, flat and line by line.
- `useLabelToolbarPlacement.test.tsx`: a toolbar that fits stays put; off the left edge and off the right edge it slides
  back 8 px inside; wider than the screen it keeps its start in view; a rect a hair off its slide settles on a whole px; a caption over the top slides it down; the slide
  relaxes on a resize once the label is clear and a scroll measures again; the flip below near the top; nothing
  slides while the toolbar has no size or before the editor and toolbar mount; the listeners go on unmount; the
  transform's slide in editor units at zoom 0.5, 1 and 2. `lib/clamp-to-viewport.test.ts` pins the start edge of a
  box wider or taller than the viewport.
- `LabelEditor.escape.test.tsx`, `LabelEditor.cap.test.tsx`, `useRichTextSession.test.tsx`,
  `useRichTextRuns.test.tsx`, `rich-text-dom.test.ts`, `block-type.test.ts`, `same-active-format.test.ts`,
  `label-style.test.ts`, `fit-multiline-text.test.ts` and `text-hug-measure.test.ts`: the products' tests, moved.
- Each product keeps the tests that drive its binding: livediagram's mind keys, livedesign's and livedocuments' cap
  test through `renderLabel`, livedocuments' run effects, every note editor test.
