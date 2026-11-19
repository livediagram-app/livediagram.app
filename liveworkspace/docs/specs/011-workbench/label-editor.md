# Label editor

Typing a label on the canvas (a shape's label, a text box, a sticky note, a mind node, a page's title) opens one
in-place editor: a `contentEditable` over the element that paints the label's runs, takes typing, Enter, paste and
the formatting shortcuts, and commits on a click away, Escape or the page going. What the editor does for a person is
each product's spec (`<product>/docs/specs/008-canvas/canvas-and-palette.md` "Labels", and "Typing in a long label
stays light" in its `canvas-performance.md`). This page is the part livediagram, livedesign and livedocuments share:
one editor in `@liveworkspace/workbench`, and the small binding each product keeps.

The three products held near-identical copies of the editor (Work Tracker 1188). A fix had to be made three times: the
long-text typing fix of Work Tracker 1081 (PR #1896) was. The copies differed only in their imports, their comments
and a few product bits; one copy now holds the behaviour, and each product hands in its bits.

## What is shared

Everything under `packages/workbench/src/components/label-editor/`:

- **The editor.** The `contentEditable`, its keys (Escape keeps what was typed and leaves; Cmd or Ctrl with B, I and U
  toggle a run; Enter inserts a newline as text; a paste goes in as plain text), the label's character cap, the
  type-to-edit end caret, the focus guards for the toolbar and the context menu riding alongside, and the floating
  toolbar's frame (counter-scaled against the zoom, flipped below the element near the top of the screen, captioned
  "Selected Text").
- **The session.** The runs it opened with, the auto-fit of a multi-line label on Scale, the live text out to a text
  box that grows with it, and the commit: on blur, on unmount when the text changed, and before the page goes.
- **The runs machine** the label editor and the note editor both stand on: paint, read-back, the selection's
  offsets, the repaint after a format apply, the toolbar's active format and the formatting commands.
- **The label's typography**: the run style, the size tables, the wordmark type, the alignment, and the auto-fit of a
  multi-line label.
- **The hug measurer**, which measures a text box's text with the real DOM so the box hugs its words.
- **The block types** (Paragraph, Heading 1 to 3, Title, Caption) and the list detection.

## What each product keeps

| Product       | Kept                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| every one     | its `RichTextEditor`, a binding: its label toolbar (its colours, contrast reading and editor context), its telemetry for a format command (`Element / Changed / TextFormat`)                          |
| livediagram   | a mind node's Tab and Enter, which commit and grow the next node, and Escape out of a placement leaving the selection too; the mind node's label measure                                              |
| livedocuments | Text Effects: a run's highlight and gradient painted on its span and measured with it, and the toolbar's effects control                                                                              |
| every one     | its `label-style` and `text-hug-measure` bindings at their old paths (livedocuments' carry the effects), the text box's geometry (`lib/text-hug`), and the note editor around the shared runs machine |

A run's highlight and gradient are read back from the editor in every product, as livedocuments' copy did. Only
livedocuments draws them, so nothing changes in the other two.

liveplanner and livehuddle keep copies of their own for now. They bind the same editor when they next change it.

## Right-to-left text over several lines

A label reads right to left line by line: each line takes its direction from its own first letter. The browser's
way of saying that, `unicode-bidi: plaintext`, costs the square of a line's length, so the editor already used it
only when the lines could read in different directions (a right-to-left letter and more than one line). In that case
a very long line was still slow to type into.

Now, when the lines could differ, the editor gives each line its own isolated run in that line's direction, and the
text as a whole is isolated in the direction of its first letter, as every other label editor is. That draws the
same as line by line (alignment is the label's own Left, Centre or Right either way), and no line pays the
square-of-length cost. The lines are kept apart as they change: a new line, a joined line, a paste over several lines
or a first right-to-left letter lays the text out again with the caret where it was; typing within a line touches
only that line.

## Performance

- A keystroke does work for the change, not the length of the text, in every case, the mixed-direction one now
  included: measured in [the blueprint](blueprints/label-editor.md#measured).
- The shared code is the code each editor already shipped, so no editor's first-load JS grows.
