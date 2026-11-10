# The quote

## What

A **Quote**: a large pull quote with its source. One element that lays itself out, in reading order:

- a **quote mark**, a large opening mark in the accent;
- the **quote**, the element's label, set large;
- the **source**: an optional **portrait** (the person's photo, or their initial on a soft disc) beside their
  **name** and **role**.

It is a `shape: 'quote'`, a web component ([Web components are elements](web-components-and-no-groups.md)), so it
keeps every ordinary element behaviour: move, resize, rotate, lock, layers, colours, font, shadow, accent edge,
comments, links, copy / paste, undo and the Shape and Text animation sets.

## Why

Testimonials and pull quotes are on nearly every pitch deck and landing page, and the layouts that had them (the
Quote slide, Testimonials, the Quote infographic page) built each one from five loose pieces: a quote mark, the
words, a rule, a name and a role. Moving one meant moving five, resizing re-wrapped none of them together, and the
pieces drifted apart. A Card can carry a name and a line about someone, but it reads as a panel, with the words as
the small print. A quote is the reverse: the words are the headline and the person signs it.

## The slots

| Slot       | Field                                                          | Off when                  |
| ---------- | -------------------------------------------------------------- | ------------------------- |
| Quote mark | always drawn                                                   | the box is too small      |
| Quote      | `label` / `richText`, the ordinary label                       | never (placeholder shown) |
| Portrait   | `imageId` (a photo); else `cardMedia: 'initial'` (the initial) | neither is set            |
| Name       | `pageTitle` (single line, the Page's field and bound)          | empty                     |
| Role       | `pageSubtitle` (single line)                                   | empty                     |

**The label is the quote**, so double-click edits it with the normal label editor (rich text, alignment, size, bold).
Typed quote marks are the writer's: the element draws its own mark and never adds marks to the text. The name and
role **edit in place** once the quote is selected, the web components' rule: the first click selects, the next one
edits, Enter commits, Escape restores.

**The portrait** is a circle at the source's left:

- **Photo**: a picture from the gallery, filling the circle (cover). It is set from the quote's menu (**Add Photo**,
  which opens the picture picker, then **Change Photo** / **Remove Photo**). The photo is an ordinary gallery image
  placed by the document, so it is kept, shared, exported and taken offline exactly as an image element's picture
  is ([Images](images.md)).
- **Initial**: the first letter of the name on a soft accent disc (a "?" with no name), the card's initial.
- Neither: the source is the name and role alone, ranged left under the quote.

A photo wins over the initial; removing the photo shows the initial again when `cardMedia: 'initial'` is set.

## Looks

`quoteLook: 'plain' | 'card'`, absent is `card`. The quote paints its own surface (it is one of the self-painting
kinds, like the stat row), so a theme change, which writes every shape's fill, never undoes a Plain look:

- **Card**: a rounded box in the element's fill with a 1 px accent border (its corner the element's `borderRadius`,
  Large by default), the quote inside it with padding.
- **Plain**: no box at all, for a pull quote set straight on a slide: the quote mark, the words and the source alone.

As a self-painting kind the quote offers the corner radius but not the border strength or pattern (the stat row's
rule).

## Layout

One pure function in `@livedocuments/document`, `quoteLayout`, computes every rect from the element's size, the
look and which slots are on; the canvas and the headless SVG renderer both call it, so an export matches the editor.

- The quote mark sits top left, its size a share of the box (`clamp(min(h * 0.22, w * 0.16), 24, 120)` px).
- The source band is at the foot: its height follows the name size, the portrait as tall as the name and role
  together (at least twice the name's size).
- The quote takes the room between them. Its text size is the element's label size, and the palette's quote lands at
  26 px, bold, so the words read as the headline and two lines fit its starting box.
- A box too small for every slot drops them in this order: the role, then the portrait, then the quote mark. The
  quote always keeps its room.

## Colours

A themed surface like the card: the element fill (in the Card look), the ink for the quote, the accent for the quote
mark, the initial disc and the border. The name is the ink, bold; the role is the ink at 70%. A theme switch rethemes
it like any shape.

## Palette

**Components**: **Quote** (Card look, an initial, a name and a role) and **Pull Quote** (Plain look, no portrait,
just a name). Each places by tap or drag like every component, at 460 × 220 and 520 × 180.

## Editing the slots

A **Quote** section in the element's menu (Tools flyout), closed until opened:

- **Look**: Card / Plain.
- **Portrait**: None / Initial / Photo. Photo opens the picker; with a photo set the row carries **Change Photo**
  and **Remove Photo**.
- The name and role are edited on the canvas; their lines show placeholders ("Name", "Role") while the quote is
  selected and they are empty.

Roles: an **Editor** edits every slot. A **Participant** may write the quote's words, name and role (the label,
`pageTitle` and `pageSubtitle`, the text every shape lets them write) but not its portrait or look. A **Viewer** edits nothing; the photo is shown to anyone who can open the
document.

## Templates

- The **Quote and Picture** slide layout (Pictures), which built its quote from five loose pieces, places a Plain
  quote beside its picture.
- The **Testimonials** slide layout (Content) is new: a heading over two Card quotes side by side, each with an
  initial portrait, ready for a photo.
- The page layouts that build quotes from loose pieces (the Quote page and Testimonials, whose cards carry star
  ratings) keep their pieces for now.

## Agents and export

- The MCP element docs name `shape: 'quote'` with `label` (the quote), `pageTitle` (name), `pageSubtitle` (role),
  `quoteLook`, `cardMedia: 'initial'` and `imageId` (a gallery id from list_images; one not in the gallery is
  refused, as for an image).
- The text views list a quote as `“quote” (name, role)`.
- Every export draws the quote from `quoteLayout`, its photo embedded like an image element's.
- Office export: a quote is drawn as a picture of itself, like the other web components.

## Non-goals

- Star ratings inside the quote (a Rating element beside it does that).
- A company logo slot (a logo strip or an image beside it).
- Carousels of several quotes in one element.
