# Stat row: big numbers, changes and count-up

## What

The Stat row ([Web components are elements](web-components-and-no-groups.md)) is the deck's number element. Pitch
decks, reports and dashboards lean on stats, and a stat on a slide usually says three things: the number, what it
counts, and how it moved. Three additions make it carry all three and land with some ceremony:

1. **A change line** on each stat: an optional short line such as "▲ 12%" or "-3 pts", coloured up or down.
2. **Count-up when presented**: while a slide is presented, each number counts up from zero to its value as the
   slide comes on.
3. **The Big Number**: a palette preset that places a stat row holding one large stat with a change line, the big
   number tile a pitch deck puts on a slide on its own.

None of this is a new element. A big number tile is a stat row with one stat; the change is a field of each stat.

## Why

Before this the stat row held a value and a caption, and decks that wanted "86k active teams, +24% on last year"
built it from loose text boxes (the Three Stats slide layout still does, for its type). Loose boxes come apart and
can't animate as a number. The change line belongs to the stat it describes, and counting a number up is the one
animation a stat has that nothing else does.

## The stat

```ts
type StatItem = { value: string; caption: string; change?: string };
```

- `change` is at most `STAT_CHANGE_MAX` (24) characters, one line, trimmed like every row string. Empty is no
  change: the field is left out and the stat draws no change line.
- A stat row may mix stats with and without a change.

### Which way it moved

The direction is read from the change's text, never stored, so typing the line is all it takes:

| First character                           | Trend  | Colour (light paper / dark paper) |
| ----------------------------------------- | ------ | --------------------------------- |
| `▲` `↑` `+` `⬆` `△` `▴`                   | `up`   | green (`#15803d` / `#4ade80`)     |
| `▼` `↓` `-` `−` (minus) `–` `⬇` `▽` `▾`   | `down` | rose (`#be123c` / `#fb7185`)      |
| anything else (`=`, `→`, a word, a digit) | `flat` | the stat's caption ink, muted     |

The colour describes the direction, not whether it is good: a fall in churn is still a fall. Someone who wants
"down is good" writes the line without a sign ("12% less churn") and gets the neutral ink, or colours nothing.

The trend colour is lifted or deepened until it meets **4.5:1** against the card's fill (the same lift the progress
label uses), so the line reads on any theme.

### How it looks

The change sits under the caption as a small pill: the trend colour as text over a soft wash of it (12%), fully
rounded, at the caption's size. A flat change has a wash of the ink. The layout gives a stat row with any change a
third line, so its values are a little smaller than a row without one at the same height, and every card in the row
lines up whether or not its own stat has a change.

## Count-up when presented

While the open tab is presented ([Presentation mode](../012-collaboration/presentation-mode.md)), each stat's value
counts up from zero to itself as the element comes on screen: when its slide is shown (a slide is mounted fresh), or
when Present starts with it showing. It plays once and holds the value.

- **What counts.** A value counts when it reads as a number with words round it: an optional prefix without digits
  ("$", "€", "~", "#"), a number (digits, an optional `,` thousands grouping, an optional decimal part), and an
  optional suffix without digits ("%", "k", "M", "x", "+", " users"). "$1.2M", "98%", "3,400", "4.8", "12k" count.
  "24/7", "Q3", "v2.1", "1-2", "N/A" do not, and show as they are.
- **How it counts.** From 0 to the number over `STAT_COUNT_MS` (1,200 ms), easing out (cubic), with the number's own
  decimal places and its grouping kept at every frame ("3,400" passes "1,700", "4.8" passes "2.4"), and the prefix
  and suffix shown throughout. Digits are tabular, so the width does not jitter as it counts.
- **Reduced motion.** With `prefers-reduced-motion: reduce` there is no count: the value shows at once.
- **Off switch.** `statCountUp: false` on the element turns it off for that row; absent is on. The Stats section of
  the element's menu carries a **Count Up When Presented** toggle.
- **Never in the editor or an export.** Editing, Viewing outside a presentation, thumbnails and every export (SVG,
  PNG, PDF, PowerPoint) show the value as typed. Nothing is broadcast: each screen counts on its own as the slide
  appears there.
- **Screen readers** hear the value as typed: the counting text is hidden from them and the card carries the value as
  its label.
- **Cost.** The count runs inside the stat row alone: one animation-frame loop per counting row, writing the digits
  straight into its own text nodes, ending after 1.2 s. The editor does not re-render for it.

## The Big Number

A palette preset of the Stat row, the variant `big-number` (`applyShapeVariant`): one stat ("86k", "Active teams",
change "▲ 24% on last year"), 320 × 220, `borderRadius: 'lg'`. It sits in **Components** beside the Stat Row as
**Big Number**. Like every preset it is an ordinary stat row: Add Stat makes it a row.

A stat row's value size follows its height and its card's width (`statRowLayout`); a single stat 220 tall gets the
largest value the layout allows (`STAT_VALUE_MAX_PX`, 96 px, raised from 72 so a tile reads as a headline).

## Editing

- The change line edits in place like the value and the caption: select the row, click the line, type. In a row
  that has a change line (any of its stats has a change), a stat without one shows a faint "Change" placeholder
  while the row is selected and editable, so the others can be filled in place; unselected it draws nothing.
  Committing an empty line removes the change.
- The **Stats** section of the menu (Tools flyout) shows each stat's value, caption and change, and the Count Up When
  Presented toggle.
- Roles: an Editor edits the change and the toggle; a Participant and a Viewer cannot (the stat row is not one of the
  fields a Participant may write).

## Agents and import / export

- The MCP element docs name `change` on each stat and `statCountUp`.
- The text views (outline, pages) list a stat as `value caption (change)`.
- Every export draws the change pill from the same layout and colours as the canvas.

## Non-goals

- Counting down, counting from a number other than zero, or counting things that aren't numbers.
- A stored trend that disagrees with the text.
- Sparklines inside a stat (a Line chart beside it does that).
