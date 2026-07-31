# 102 — The block-type picker

Status: shipped

## What

One dropdown in the rich-text toolbar — **Paragraph, Heading 1, Heading 2,
Heading 3, Bullet point, Numbered point** — replacing the separate list
buttons.

## Why one control

Heading level and list style are two independent run attributes, but to a
writer they are one decision: a line is a heading, or a paragraph, or a
bullet. The toolbar exposed them as five toggles (two heading buttons beside
bullet / numbered / remove-list), which made the user infer that "Heading" and
"Bullet list" were mutually exclusive in practice even though nothing said so,
and left "remove list" as a button whose job is really "go back to Paragraph".

A closed vocabulary states the exclusivity instead of implying it. Picking any
entry applies **both** attributes — a heading clears the list, a bullet clears
the heading — so a line can never land in a state the picker cannot describe.

## Scope of an apply

The selected lines, or the **whole text** when nothing is selected. That is
the label editor's existing `collapsedScope: 'all'`, so the picker inherits
the rule rather than inventing one.

Note this differs from the note editor, where a collapsed caret scopes a block
command to the **line** (spec/92). That difference is deliberate there and
untouched here.

## Three heading levels

`RunHeading` widens from `1 | 2` to `1 | 2 | 3`. Two levels made the third
option conspicuously missing from a list that otherwise reads like a word
processor's.

**Labels and pages now render headings at all** — they never did; `heading`
was a note-only attribute (spec/92). The label renderer sizes them in `em`
rather than the note renderer's fixed px, because a label, a sticky and a Page
(spec/100) carry different base sizes and a pinned 17px H1 would come out
_smaller_ than the body on a large element.

## Detecting the current type

A list is literal line-prefix text (`• `, `1. `), not a block node (spec/92),
so the picker reads the prefix — there is nothing to ask. It reports the
**first** line of the selection: a selection spanning a bullet and a paragraph
has no single honest answer, so it reports where the selection starts.

## Both toolbars, one control

The label toolbar (`RichTextToolbar`) and the note toolbar
(`NoteFormatToolbar`) render the same `BlockTypePicker`. The note toolbar's six
old buttons (H1 / H2 / H3 beside bullet / numbered / remove-list) are gone, and
so are the four glyphs that labelled them.

Only the apply **scope** differs, and it lives in each editor's session rather
than in the picker: a collapsed caret means the whole text in a label and the
current line in a note (spec/92).

`ToolbarDropdown` moved out of `RichTextToolbar` into
`components/rich-text/ToolbarDropdown.tsx` for the same reason — one menu
behaviour (inline, not portalled; closes on outside pointerdown; never steals
the editor's selection), not two copies to drift.

## Verified

`block-type.test.ts` covers `blockTypeOf` / `blockTypeApplies` /
`listStyleOfText`, including the round-trip that makes the vocabulary closed:
applying any type and reading it back gives the same type.

Driven in a browser on both surfaces. In a note: Paragraph → Bullet point turns
`First line` into `• First line` and the trigger reads "Bullet point"; picking
Heading 2 next clears the bullet (`First line`) and the trigger follows.
