# 120 — The record

Status: shipped

## What

A **Record**: a title bar over a list of `name: Type` rows. One element covering
the UML class box and the ER entity box.

## Why

The UML class template built one out of, in its own words:

> two flush-stacked tables sharing a groupId… so the seam between the tables
> draws the attribute / method separator

That is two elements pretending to be one, held together by a group, with a
border seam standing in for a divider. Move one half and the class comes apart.

Structured notation — UML, ER, BPMN — is where draw.io beats everything else,
and engineering teams sketching architecture are the first group
[spec/00](00-purpose.md) names.

## The element

`shape: 'record'`, one new field:

```ts
recordFields?: { name: string; type?: string }[];
```

Bounded at 40 rows / 80 characters, like the checklist (spec/83), so a paste
can't produce an element nobody can read.

**The element's `label` is the title.** A record needs no separate name field,
and using the ordinary label means the title edits, formats, aligns and exports
like every other label. Only the rows are bespoke.

`type` is optional because half the uses don't carry one — an ER attribute
list, a rough class sketch — and an empty column reads better than a
placeholder. It stores as `undefined` when cleared, so a row that never had a
type round-trips identically to one that had it removed.

## Editing

The rows live in a **Fields** section in the right-click menu (under the Tools
flyout, where the other data-shape editors sit), mirroring the checklist's row
editor: a name input, a type input, a remove button, and Add field. Same shape
of problem — a bounded list of short strings edited in a narrow menu — so the
same shape of control.

## Not two elements

A UML class conventionally has _two_ compartments (attributes, then methods).
This ships **one** list, because the divider is the only thing that differs and
a second bounded array doubles the model, the editor and the renderer for it.
A method row is `render(): void` in the name column, which is what the
stacked-tables template was spelling out by hand anyway.
