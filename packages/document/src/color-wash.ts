// A translucent wash of a colour, for the surfaces that are derived from an
// element's own colour rather than written as a fixed grey (a Behaviours
// card's chips, a chair's seat). Tying them to the element's colour keeps
// them agreeing with the TAB theme (docs/specs/011-theme/multicolour-themes.md), which a Tailwind light / dark
// pair (that follows the APP's mode) does not. Shared by the editor
// (apps/live lib/element-tint.ts) and the headless render.

/** `rgba()` for a hex; `color-mix` for anything else (a named / rgb() /
 *  oklch() colour this can't parse), which a browser without it drops,
 *  leaving the surface untinted rather than wrong. */
export function colorWash(color: string, alpha: number): string {
  const hex = color.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
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
