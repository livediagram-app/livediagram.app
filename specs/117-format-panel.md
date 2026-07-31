# 117 — Format Panel

Status: **implemented**.

While the **Format** painter ([spec/09](09-canvas-and-palette.md)) is active, a **Format** panel is present: which parts of the copied style actually get painted, and whether the brush stays loaded after a paint. The fifth mode panel, after [Avatar](101-avatar-mode.md), [Laser](111-laser-panel.md), [Spotlight](112-spotlight-panel.md), and [Eraser](113-eraser-panel.md).

## Why

The painter copies **everything**: fill, border, every text switch, size, padding, shadow, opacity, animation. That is the right default and the wrong only option.

The cases it fails are the ordinary ones. You want a row of boxes to share a fill but keep the widths you spent five minutes setting. You want one element's typography on a differently-coloured card. You want a dashed border on a shape whose fill is deliberately different. Today each of those is: paint, then undo half of it by hand.

A short list of what-to-copy toggles turns the painter from one blunt action into the tool people already assume it is. It is per-job, not per-account, so it belongs in the tool's own panel rather than in Settings.

## The settings

- **Copies** — five toggles, all on by default (which is exactly today's painter):
  - **Fill** — the fill colour and its theme-preset binding ([spec/48](48-style-presets.md)).
  - **Border** — stroke colour, width, pattern, corner radius; on an arrow, the line's look including arrowheads, path style, and route-behind.
  - **Text** — colour, size, weight, italic / underline / strikethrough, font, alignment.
  - **Effects** — shadow ([spec/86](86-element-shadows.md)), opacity, and the looping / icon / flow animations.
  - **Size** — width, height, aspect lock, padding, icon size.

  Turning them all off leaves nothing to paint, so the panel says so and the brush goes inert rather than silently doing nothing on every tap.

- **After painting** — **Keep the brush** (today: paint target after target until you leave the tool) or **Paint once** (the brush empties after one apply, like the single-shot painter in the selection toolbar).

## Which field belongs to which toggle

`lib/format-painter.ts` stays the single source of truth for **what CAN be painted**; the panel decides **which of it does**. The mapping from field to toggle lives beside it in `lib/format-config.ts`, and a test asserts that **every field either projection produces is assigned to a group** — so a field added to the painter later can't quietly escape the panel and always travel regardless of the toggles.

## The panel shows what is loaded

The top of the panel is the brush itself: the source element's name and a swatch drawn from the parts currently enabled, or "Pick something to copy from" when nothing is loaded yet. A painter whose contents you cannot see is a painter you press hopefully.

## Persistence

Device-local, in `localStorage` (`livediagram:v2:format-config`), like the other tool panels. Never sent to the api, never in the synced preferences blob ([spec/20](20-user-preferences.md)).

The **Copies** toggles are the setting most likely to be wrong later — someone leaves Fill off, comes back tomorrow, and wonders why the painter isn't copying colours. So the panel keeps the count in view ("Copies: Border, Text") and the brush swatch shows only what is enabled.

## Telemetry

Per [spec/22](22-telemetry.md): toggling emits `UI·Changed·FormatCopies`, and the mode emits `UI·Changed·FormatMode`. Painting itself still reports `Element·Changed·FormatPainter`, as before.

## Out of scope

- Painting between kinds (a shape's look onto an arrow). The two share almost no formattable fields, which is why it is a no-op today.
- Painting content — labels, links, comments. The painter copies looks; that boundary is what makes it safe.
- Saving named brushes ("my heading style"). That is style presets ([spec/48](48-style-presets.md)) wearing a different hat.
