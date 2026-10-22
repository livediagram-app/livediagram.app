# Counts are badges

Status: **implemented**.

A number that counts something beside a label is a **badge**, never text in
brackets. "Reveal (3)", "Gallery (12)" and "Active links (2)" read as prose
that happens to contain a number; a badge reads as a count at a glance, lines
up from label to label, and matches the Explorer's folder counts.

- **Chrome** (panels, dialogs, menus, tiles) uses `CountBadge`
  (`packages/ui/src/CountBadge.tsx`, shared with the marketing site), the same grey pill the
  Explorer puts beside a folder's name. `MenuTile` takes a `count`, and the
  element `…` menus' rows put the badge at their trailing edge.
- **On the canvas** a board's own controls draw the badge in the card's accent
  (`AccentBar`'s `count`), because canvas elements take their colours from the
  tab theme, not from the app's grey.
- **Not a count, not a badge.** Brackets that are part of a value stay text: a
  poll option numbered to tell two people with the same name apart ("Guest
  (2)") is the option's name, and an accessible label spells its count out in
  words for a screen reader.

A guard test (`apps/live/count-badges.test.ts`) fails on a UI string that puts
a count's `.length`, `count` or `total` in brackets.
