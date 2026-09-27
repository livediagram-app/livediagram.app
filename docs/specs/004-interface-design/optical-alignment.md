# Optical alignment

Status: in review

## What

A glyph sits at the **centre of the shape that holds it**, and glyphs that stand side by side share
one line. A glyph is a letter, a numeral, a person's initials, a short all-caps label or an icon. A
shape is any small painted outline that frames one: a disc (circle), a chip (pill), a badge, a
square tile, a count. The rule holds in every app (editor, help centre, marketing site, telemetry
dashboard), in both appearances, and on the canvas and in its SVG export.

## Why

Flex centring centres a text's **line box**, not its ink. A capital or a digit has no descender, so
its line box carries empty space below the letter, and a centred box leaves the letter sitting high.
The amount depends on the face, so the same markup looks centred on one operating system and off on
another: the UI uses the system font stack. Icons drift for a different reason: many were drawn by
hand with their geometry off the centre of their own viewBox. A row of stacked actions (icon over
label) drifts a third way: when one action's icon is taller, its label drops.

Each offset is one or two pixels. Together they make the chrome look careless, which is the
opposite of what a diagramming tool has to look like.

## Terms

- **Shape**: an element with visible paint (a fill, a border or a ring), at most 44px tall, framing
  one glyph run.
- **Glyph run**: the shape's content: text of at most a few words, an icon, or an icon beside text.
- **Cap band**: the band of a text run from its baseline up to the face's cap height.
- **Ink box**: the bounding box of the pixels a glyph actually paints.
- **Optical offset**: the distance, per axis, from the centre of the shape's box to the centre of
  the glyph (the cap band vertically for text; the ink box otherwise).
- **Stack**: an action drawn as an icon over a label, such as a header action.
- **Stack row**: stacks standing side by side in one row.

## The rules

- **Tolerance.** Every optical offset is at most **0.5 CSS px** on each axis.
- **Text centres on its cap band.** Text in a shape is trimmed to cap height and baseline (CSS
  `text-box: trim-both cap alphabetic`, through the shared `text-optical-centre` utility), so flex
  centring lands on the letters. This covers initials, step numbers, counts, poll letters and
  all-caps chips. Mixed-case text is centred the same way: descenders hang below the band, as in
  type.
- **Horizontal centring is by ink, except where the typeface decides.** Each edge of the content is
  judged by what sits at it: an icon, a dot or a disc by its ink; a word by its advance, whose side
  bearings are the typeface's spacing. Initials and symbols are judged by ink. **Numerals are
  advance-centred**: a "1" or a "7" leans inside its advance by design, and is left as the typeface
  draws it.
- **Tracked text gives back its trailing space.** Tracked (letter-spaced) text carries a space after
  its last letter, so a tracked label pulls its trailing edge in by one tracking step.
- **An icon at an edge is compensated by its own margin.** An icon drawn inside its box leaves blank
  space at the box's edges. When the icon is the first or last thing in a button or chip, that side's
  padding is reduced by the icon's blank margin, so the padding is measured to the ink. Each icon's
  margins come from the icon catalogue, computed from its drawing, never measured in the browser.
- **Icons are drawn centred.** An icon's geometry, stroke included, is centred in its viewBox at its
  rendered size. An icon that is asymmetric on purpose, such as a play triangle, is a named, logged
  exception. The rule is enforced in the icon catalogue ([Iconography](iconography.md)); this spec
  only relies on it.
- **A chip is centred as a whole.** An icon plus label centres their combined ink. A chip that leads
  with a disc filling its height follows the concentric rule instead: the disc sits as far from the
  chip's leading edge as from its top and bottom, and the trailing side may be roomier
  ([Colour scheme](color-scheme.md#usage-rules)).
- **A stack row shares one line.** Every stack in a row reserves the same icon slot (**20px** in the
  editor header), whatever it holds: an icon, an avatar, a spinner. Labels in a row share one
  baseline and icons share one centre.
- **SVG text centres on its cap band too.** Text drawn in SVG (canvas badges, the export, marketing
  art) sits on the alphabetic baseline, placed half the face's cap height below the shape's centre.
  SVG has no text trimming and `dominant-baseline: central` centres the em box, not the letters.

## The primitives

One implementation per shape, shared from `@livediagram/ui`, so the rule is written once:

- **Glyph disc**: a circle holding a letter, initials, a numeral or an icon, at a named size.
- **Chip**: a pill or badge holding an optional leading icon and a label, with the caps variant's
  trailing tracking balanced. It keeps the height its padding gives it.
- **Icon slot**: a fixed square that centres whatever it holds; stacks put their icon in one.
- **Button label**: every button, and every link styled as one, centres its label's cap band without
  changing its height, and measures its padding to an edge icon's ink.

Existing ad-hoc shapes move onto these primitives. A new shape that frames a glyph uses one of them.

## Guards

- **An ink audit** (end-to-end, dark mode, at 4x device pixels) opens the editor, its dialogs, the
  wizard, the Explorer, the help centre, the marketing site and the telemetry dashboard, and fails
  on any shape or stack row outside the tolerance. It measures the rendered pixels, so it holds for
  whatever face the browser picks.
- **A static guard** fails when a circle or chip framing text bypasses the primitives or the
  utility, naming the file and line.
- **The icon geometry check** belongs to [Iconography](iconography.md): catalogue icons off-centre
  by more than the tolerance fail there, unless they are a logged exception.

## Out of scope

- The drawing of icons (stroke weight, metaphors, the base library, the `Icon` primitive and its
  size steps) belongs to [Iconography](iconography.md). The primitives here take any icon as their
  content.
- User content on the canvas (labels in shapes the user draws) follows the element's own text
  layout, not this rule.
- Large illustrations (marketing feature art, help illustrations) keep their composition; only the
  small badges and discs inside them follow the rules.
