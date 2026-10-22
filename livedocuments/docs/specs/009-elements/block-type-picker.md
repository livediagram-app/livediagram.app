# The block-type picker

## What

One dropdown in the rich-text toolbar: **Paragraph, Heading 1, Heading 2,
Heading 3, Bullet point, Numbered point**, and in a label the **Title and Caption** preset (below). It is the toolbar's only heading and
list control; there are no separate list buttons.

## Why one control

Heading level and list style are two independent run attributes, but to a
writer they are one decision: a line is a heading, or a paragraph, or a
bullet. Exposed as five toggles (two heading buttons beside bullet / numbered /
remove-list), they make the user infer that "Heading" and "Bullet list" are
mutually exclusive in practice even though nothing says so, and leave "remove
list" as a button whose job is really "go back to Paragraph".

A closed vocabulary states the exclusivity instead of implying it. Picking any
entry applies **both** attributes (a heading clears the list, a bullet clears
the heading), so a line can never land in a state the picker cannot describe.

## Scope of an apply

The selected lines, or the **whole text** when nothing is selected. That is
the label editor's `collapsedScope: 'all'`, so the picker inherits the rule
rather than inventing one.

Note this differs from the note editor, where a collapsed caret scopes a block
command to the **line** ([Rich-text notes](rich-text-notes.md)). That difference is deliberate there and
untouched here.

## Three heading levels

`RunHeading` is `1 | 2 | 3`. Two levels would leave the third option
conspicuously missing from a list that otherwise reads like a word processor's.

**Labels render headings**, as notes do ([Rich-text notes](rich-text-notes.md)). The label
renderer sizes them in `em` rather than the note renderer's fixed px, because a
label, a sticky and a card carry different base sizes and a
pinned 17px H1 would come out _smaller_ than the body on a large element.

## Detecting the current type

A list is literal line-prefix text (`• `, `1. `), not a block node ([Rich-text notes](rich-text-notes.md)),
so the picker reads the prefix: there is nothing to ask. It reports the
**first** line of the selection: a selection spanning a bullet and a paragraph
has no single honest answer, so it reports where the selection starts.

## Both toolbars, one control

The label toolbar (`RichTextToolbar`) and the note toolbar
(`NoteFormatToolbar`) render the same `BlockTypePicker`. Neither toolbar has
separate heading or list buttons, nor glyphs for them.

Only the apply **scope** differs, and it lives in each editor's session rather
than in the picker: a collapsed caret means the whole text in a label and the
current line in a note ([Rich-text notes](rich-text-notes.md)).

`ToolbarDropdown` lives in `apps/live/components/rich-text/ToolbarDropdown.tsx`,
shared by both toolbars for the same reason: one menu behaviour (inline, not
portalled; closes on outside pointerdown; never steals the editor's
selection), not two copies to drift.

## Title and Caption

Below a divider, the label toolbar's picker has one more entry, **Title and Caption**: a whole-label preset for the
common two-tier node ("Payments" over "Stripe, EU region").

- The **first line** becomes the title: bold, the label's own size.
- **Every later line** becomes the caption: one run size smaller (`sm`) and **muted**, drawn at 65% of its colour's
  opacity so it reads as secondary in any theme and on any fill.
- A label with **one line** gains a second line reading "Caption", styled, so the caption is visible to replace.
- It applies to the whole label whatever the selection (it describes the label's layout, not a line), and clears
  any heading or list prefix it finds, so the result is always the same two tiers.
- It is one history step, and the picker's trigger keeps reporting the first line's block type.

The note toolbar does not offer it: a note is a document, not a node.

`muted` is a run attribute beside `color` (`TextRun.muted?: boolean`), so the caption keeps the label's own colour
and follows a theme switch rather than baking a grey. Every label renderer and every export draws a muted run at
0.65 opacity; Markdown output drops it, as it drops colour. There is no separate toolbar control for it: Title and
Caption is how a label gets one, and clearing formatting removes it.

Animation is unchanged: the Text set animates both tiers as the label's words.

## Verified

`block-type.test.ts` covers `blockTypeOf` / `blockTypeApplies` /
`listStyleOfText`, including the round-trip that makes the vocabulary closed:
applying any type and reading it back gives the same type.

In a note, Paragraph → Bullet point turns `First line` into `• First line` and
the trigger reads "Bullet point"; picking Heading 2 next clears the bullet
(`First line`) and the trigger follows. The label toolbar behaves the same.
