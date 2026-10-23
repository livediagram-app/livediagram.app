# Empty states

A list, a picker, a panel or a search that has nothing to show says so with an **empty state**, never a bare line of
small grey text. Every empty state reads alike, wherever it is: an icon in the brand badge, a heading that starts
"No", a line that says what to do next, and at most one way forward.

## The copy

- The heading always names what is missing, in the plural, and starts **"No <things>"**: "No layouts", "No icons",
  "No settings", never "Nothing matches", "No matches" or "No results". A search across several kinds names them
  ("No designs, folders or help articles match “x”").
- The heading is a sentence (it can quote the person's own words), so it is written in sentence case with no full
  stop. Its action button is Title Case, as every button is.
- **A search found nothing**: "No <things> match “<words>”". The words are the trimmed query, cut to
  `NO_MATCH_QUERY_MAX` (40) characters with an ellipsis.
- **Filters found nothing** (no words typed): "No <things> match these filters".
- **Words and filters together** found nothing: "No <things> match “<words>”"; the words are what the person changes
  first.
- **Nothing exists yet**: "No <things> yet".
- The line under the heading is one short sentence that says what to try: "Try another word." for a search,
  "Remove a filter to see more." for filters, or the surface's own advice ("Try a broader word."). A surface may leave the line out where the heading and action say enough.
- The way forward is at most one button: **Clear Search** (clears the words), **Clear Filters** when only filters
  narrowed it, **Clear Search and Filters** where one press takes both and both are in force,
  or the surface's own ("Browse").

## The look

- **Regular** (`size="regular"`): a panel or a dialog's list. A 40px brand badge, a 13px semibold
  heading, a 12px line, centred, with 16px of padding.
- **Small** (`size="small"`): inside a popover, a menu, a dropdown list or a palette tab. A 28px brand badge, a 12px
  semibold heading, an 11px line, centred, with 12px of padding.
- **Page** (`EmptyState` in `@livedesign/ui`): a page-sized list (the Explorer's views, the Trash), with the floating badge and its rings. Same copy rules.
- **In place of one item.** Where a list's items are cards or rows on a known surface (Home's Jump back in), the empty state takes the size and place of one item, so an empty list looks like a list with one thing
  in it rather than a large centred message.
- The badge holds the surface's own glyph; a search's empty state defaults to the search glyph.
- On a surface painted in its own theme (a page), the heading and the line take that surface's text
  and muted colours (`ink`); the badge keeps the brand.
- The heading wraps anywhere, so a long unbroken query never widens its popover.
- A search's empty state is a polite status, so a screen reader hears it as the list empties: a visually hidden
  `role="status"` region that mounts empty and takes the heading and line a moment later (a region that arrives
  holding its words is often not announced), the words on show hidden from a screen reader so they are read once.

## What is not an empty state

- A count in a find bar ("3 of 12", "No matches") is the bar's status, not a list's empty state.
- A prompt before anything is typed ("Start typing to search.") is the
  field's hint, not an empty state.
- A field's own empty value ("No status", "No description", "No date set") is the value, not an empty state.
- A canvas element's drawn empty face (a chart with no data) keeps its own look, and its
  copy still follows "No <things> yet".

## Building it

- `CompactEmptyState` (`@livedesign/ui`) draws the regular and small sizes; `EmptyState` the page size.
- `NoMatches` (`@livedesign/ui`) is the no-results state of a search or a filter: it takes the things' plural
  noun, the words, how many filters, an optional line and an optional clear, and writes the heading with
  `noMatchTitle`. Every search or filter that can come back empty uses it, so the copy cannot drift.
- `apps/live/empty-states.test.ts` fails the build on a "No <things> yet" or "No <things> found" written as bare JSX
  text; a canvas element's drawn face is listed there as exempt.
