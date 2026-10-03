# Within reach

**Within reach** is how livediagram keeps the things a person reaches for close to hand: a small set of
**most used** items beside the **recent** ones. It is one pattern, used wherever a surface offers a short
"what you probably want next" list, so every such list fills by the same rule and reads alike.

## The rule

A within-reach set is **N most used** items plus **N recent** items, no item twice.

- **Most used**: the N items used most, most used first. Equal use goes to the one used most recently.
  Only an item that has been used counts as used: an item with no use never fills a most-used place.
- **Recent**: the N items used most recently, newest first, that are **not** among the most used.
- **No item twice.** An item that qualifies for both counts as **most used**; recent then fills from the next
  most recent item not already shown. So the most-used places stay put while the recent ones change.
- Each surface decides what a **use** is and how far back it counts, what N is, and what fills an empty place
  (if anything). The allocation itself never changes.
- Items that tie on everything keep the order the surface gives them, so a surface that wants a stable order
  hands them over in one.

The set is cheap to merge. The within-reach set of two lists together is always within the within-reach sets of
each list on its own, so a surface that holds items in two places (the server and this browser) works out each
side's set and then the set of both, and loses nothing.

## Where it is used

| Surface                                                       | Item          | A use                                     | N   | Empty place                       |
| ------------------------------------------------------------- | ------------- | ----------------------------------------- | --- | --------------------------------- |
| [Draw mode: Shape slots](../023-draw-mode/draw-mode.md#shape-slots) | A shape kind  | A pick; counted for as long as it is kept | 3   | The next fallback kind            |
| [Explorer Home: Jump back in](../013-workspace/explorer-home.md#jump-back-in) | A document    | A day the person opened (or edited) it, over the last 90 days | 4   | Nothing: the place is not drawn |

## Presentation

- The two groups carry **no titles**, on screen or for assistive technology: their order (most used first, then
  recent) is left to people's intuition ([Design principles: Calm by default](design-principles.md)). The items are
  one list.
- Laid out as two rows, the most used take the first row and the recent the second.
- Where the two groups share one row (a phone's strip), they **alternate**: most used, recent, most used,
  recent, then whatever is left of the longer group.

## Implementation

One shared, pure function decides every within-reach set: `withinReach` in `@livediagram/api-schema`
(`packages/api-schema/src/within-reach.ts`), used by the api worker and the live app alike
([blueprint](blueprints/within-reach.md)).
