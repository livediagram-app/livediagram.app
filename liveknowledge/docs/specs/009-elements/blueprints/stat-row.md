# Stat row: blueprint

Derived from [Stat row: big numbers, changes and count-up](../stat-row.md) and the stat row's row of
[Web components are elements](../web-components-and-no-groups.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                                  | Role                                                                                                  |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/document/src/web-components.ts`                                             | `StatItem.change`, `STAT_CHANGE_MAX`, `statRowLayout` (value / caption / change rects), `withWebRows` |
| `packages/document/src/stat-count.ts`                                                 | `statTrend`, `statTrendColour`, `parseCountable`, `countFrame`, `STAT_COUNT_MS`                       |
| `packages/document/src/shape-variants.ts`                                             | The `big-number` variant                                                                              |
| `packages/document/src/validate-shape.ts`                                             | `stats[].change`, `statCountUp`                                                                       |
| `packages/document/src/element-types.ts`, `element-fields.ts`                         | `statCountUp`                                                                                         |
| `packages/document/src/svg-render-web.ts`                                             | The export draws value, caption and change pill from the layout                                       |
| `packages/document-views/src/state-attribute.ts`                                      | `value caption (change)`                                                                              |
| `packages/agent-verbs/src/mcp/element-docs.ts`                                        | The element docs                                                                                      |
| `apps/editor/components/canvas/web/StatRowFace.tsx`                                   | The face, the change pill, `CountUpValue`                                                             |
| `apps/editor/components/canvas/useCountUp.ts`                                         | The animation-frame count                                                                             |
| `apps/editor/components/canvas/PresentingContext.tsx`                                 | `PresentingProvider`, `usePresenting`                                                                 |
| `apps/editor/components/canvas/EditorCanvasHost.tsx`                                  | Provides `presenting = presentingElements != null`                                                    |
| `apps/editor/components/palette/context-menu-web-editors.tsx`                         | The Stats section: change inputs and the Count Up When Presented toggle                               |
| `apps/editor/components/palette/palette-element-presets.tsx`, `palette-tile-defs.tsx` | The Big Number tile                                                                                   |

## Domain and naming

| Term       | Identifier                       | Meaning                                                                |
| ---------- | -------------------------------- | ---------------------------------------------------------------------- |
| Change     | `StatItem.change`                | The optional third line of a stat                                      |
| Trend      | `StatTrend`, `statTrend(change)` | `'up' \| 'down' \| 'flat'`, read from the change's first character     |
| Countable  | `parseCountable(value)`          | `{ prefix, number, decimals, grouped, suffix }` or `null`              |
| Count-up   | `useCountUp`, `statCountUp`      | The presented-slide animation and its per-element switch (absent = on) |
| Presenting | `usePresenting()`                | Whether the canvas is showing a presented slide                        |
| Big Number | variant `big-number`             | The one-stat preset                                                    |

Banned synonyms: "delta" (say change), "KPI tile" in code (say stat), "ticker".

## Behaviour and state

### Layout

`statRowLayout(width, height, count, hasChange = false)` returns, per card, element-relative rects:
`cards[i]`, and card-relative `value`, `caption`, `change` (null without a change line), plus `valuePx`,
`captionPx`, `changePx`.

1. `valuePx = round(clamp(min(height * k, cardW * 0.28), 12, STAT_VALUE_MAX_PX))`, `k = 0.34` without a change
   line and `0.28` with one.
2. `captionPx = round(clamp(valuePx * 0.45, 10, 22))`; `changePx = captionPx`.
3. Lines stack centred: value line `valuePx * 1.15`, gap 2, caption `captionPx * 1.3`, then (with a change line) gap
   6 and the pill `changePx * 1.7` tall. The block is centred vertically in the card.
4. Every card gets the same rects, so cards line up whether their own stat has a change or not.

### Trend and colour

`statTrend`: the change trimmed; first code point in `UP_MARKS` (`▲ ↑ + ⬆ △ ▴`) is `up`, in `DOWN_MARKS`
(`▼ ↓ - − – ⬇ ▽ ▾`) is `down`, else `flat`. `statTrendColour(trend, surface, ground, ink)`: up
`#15803d` / `#4ade80`, down `#be123c` / `#fb7185` (light / dark surface), flat the ink at 70%, then
`reachContrast(colour, ground, 4.5)`. The pill wash is `colorWash(colour, 0.12)`.

### Count-up

1. `parseCountable(value)` matches `^([^\d\-−]*?)([−-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([^\d]*)$` on the
   trimmed value. A suffix or prefix holding a digit fails the match, so "24/7" is not countable.
2. `countFrame(c, t)` for `t` in `[0, 1]`: `eased = 1 - (1 - t)^3`, `n = c.number * eased`, printed with
   `c.decimals` places and comma grouping when `c.grouped`, wrapped in prefix and suffix.
3. `useCountUp(ref, value, active)`: when `active` turns true (or mounts true) and `parseCountable(value)` is not
   null and reduced motion is off, after `STAT_COUNT_DELAY_MS` showing zero, a `requestAnimationFrame` loop sets `ref.current.textContent = countFrame(c, t)`
   until `t = 1`, then writes `value`. It cancels on unmount, on `active` false and on a value change; React state is
   never set, so the face renders once per count.
4. `active = presenting && element.statCountUp !== false`.
5. While presenting the value is a plain `span` (`CountUpValue`), since nothing on a slide is editable; outside it
   the value stays an `InlineTextLine`.

### Edit

- The face's change line is an `InlineTextLine` (`placeholder` "Change", `maxLength` `STAT_CHANGE_MAX`) drawn
  when the row has a change line and either the stat has a change or the row is editable.
- `withWebRows` clamps `change` to `STAT_CHANGE_MAX` and drops it when empty.
- The Stats section: a third input per row (`aria-label` "Stat n change"), and a `MenuToggleRow` "Count Up When
  Presented" writing `statCountUp: false` (on) or removing it, through `ops.commit(…, 'StatCountUp')`.

## Interfaces and contracts

- Validation: `stats` rows `{ value, caption, change? }`, change a string of at most `STAT_CHANGE_MAX`;
  `statCountUp` a boolean. Anything else is the existing `stats` issue or a new `statCountUp` issue.

## Performance and limits

- The count writes at most 6 text nodes per frame for 1.2 s per row, outside React. A slide with N rows runs N loops
  (each ends by itself).
- `statRowLayout` is pure arithmetic, called once per render of the face.

## Accessibility

- Counting spans are `aria-hidden`; the card has `aria-label` "`value` `caption` `change`".
- Reduced motion (the OS setting, read through `prefersReducedMotion`) skips the loop.
- Trend colours meet 4.5:1 on the card's fill.

## Constants and configuration

| Constant              | Value | Why                                                                                             |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `STAT_CHANGE_MAX`     | 24    | A change is a few characters ("▲ 24% on last year" is 18)                                       |
| `STAT_COUNT_MS`       | 1200  | Long enough to read as counting, short enough to land with the slide                            |
| `STAT_VALUE_MAX_PX`   | 96    | A one-stat tile reads as a headline (was 72)                                                    |
| `STAT_COUNT_DELAY_MS` | 300   | The slide's own move in (slide, fade, the entrance) lands first, so the count is seen from zero |

## Testing

| Rule                                                                                            | Test                                                |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Trend from the first character                                                                  | `stat-count.test.ts` "reads the trend"              |
| What counts, frames keep decimals and grouping                                                  | `stat-count.test.ts` "parses" / "frames"            |
| Change is clamped and an empty one dropped                                                      | `web-components.test.ts` "withWebRows stats change" |
| Layout reserves the change line for every card                                                  | `web-components.test.ts` "statRowLayout change"     |
| Validation of change and statCountUp                                                            | `validate-shape.test.ts`                            |
| Export draws the change pill                                                                    | `svg-render-web.test.ts`                            |
| Count runs while presenting, not when editing, not under reduced motion; no re-render per frame | `StatRowFace.test.tsx`                              |
| Menu toggle and change input, Editor only                                                       | `context-menu-web-editors.test.tsx`                 |

## Defaults ledger

D224, D225.
