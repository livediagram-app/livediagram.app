# Scrollbars

Status: shipped

## What

Every scrollbar in every app (editor, help centre, telemetry dashboard, marketing site) is **in the
theme**: a thin track-less bar whose thumb is a slate tone of the current appearance. Light mode
uses a light slate thumb; dark mode uses a dark one from the dark palette
([Theme](color-scheme.md)). No surface shows the operating system's default scrollbar.

## Why

A scrollbar is chrome, and chrome follows the appearance. The operating system's default is drawn
for a light page: in dark mode it lands as a bright white bar beside dark panels, the loudest thing
on screen and the least important. Until now the themed bar was opt-in (`.scrollbar-slim`), used on
six surfaces, while some sixty others scrolled with the OS default. Two more private dialects had
grown beside it (one in the help centre, one in the floating panels). Opt-in styling fails exactly
this way: every new scrolling surface is born off-theme until somebody notices.

So the themed bar is the **default**, and a surface does nothing to get it.

## The rule

- **Default, everywhere.** Every element that scrolls, and the page itself, draws the themed bar:
  thin, no track, a rounded thumb.
  - Light: thumb slate 500, slate 600 on hover.
  - Dark: thumb slate 500, slate 400 on hover (the dark palette's slate tokens).
- **One narrower variant**, `.scrollbar-slim`, for dense strips where even a thin bar crowds the
  content (the tab bar, packed panel lists). Same colours, narrower.
- **Hidden** stays a per-surface choice (a swipe carousel, a scrolling tab strip), made with
  `scrollbar-width: none`; the default never overrides it.
- No other scrollbar styling exists. A surface that wants a different bar changes this spec first.

## Accessibility

- The thumb is decoration of a control people can also operate by wheel, touch and keyboard; the
  bar stays visible and draggable (never hidden by default), and thin is still the platform's own
  thin width, not a sliver.
- **WCAG 1.4.11 (3:1).** A styled scrollbar is the author's appearance, not the browser's, so its
  thumb must reach 3:1 against the surface it sits on. Slate 500 does: 4.76:1 on white, 4.55:1 on
  slate 50, and 3.45 to 4.03:1 on the dark surfaces (slate 800 to 950). The colours the opt-in bar
  used before (slate 300 light, 1.48:1; slate 600 dark, 2.2 to 2.5:1) did not, which is why the thumb
  is a step stronger than it was. Hover moves further from the surface in both appearances.
- No layout shift: the default changes colour and width, not whether a gutter exists.

## Help

No article: this is appearance, not a feature.
