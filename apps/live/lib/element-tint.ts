// A translucent wash of an element's OWN text colour.
//
// Every chip, track, rule and texture on a Behaviours card is derived from
// `textColor` rather than written as `bg-black/6 dark:bg-white/10`. Those
// Tailwind pairs follow the APP's dark mode, and an element's colours come
// from the TAB theme (spec/29) — so a dark card on a light-mode editor got
// black-on-dark chips that vanished, and a light card in dark mode got the
// opposite. Tying them to the text colour makes every part of a card agree
// with the card, whichever way either setting is pointed.
//
// It lives in lib/ rather than beside the collab chrome because the paper kit
// (spec/122) draws every one of its textures out of it, and that kit is used
// by the behaviour faces too — a shared helper reached from one family's
// folder is a dependency pointing the wrong way.

export function tint(textColor: string, alpha: number): string {
  const hex = textColor.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    // A named / rgb() / oklch() colour we can't parse. `color-mix` handles any
    // of them, and a browser without it falls back to the declaration being
    // dropped — which leaves the surface untinted rather than wrong.
    return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
  }
  const body = match[1]!;
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
