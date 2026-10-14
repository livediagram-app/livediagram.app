// The colours a built-in theme paints, in either half (blueprint "The checks", LN17): its element fill or stroke (or,
// where the theme leaves that to the element, the element type's own default), every palette and root
// entry, and every per-shape override. A custom theme is not known here: null.

import {
  DEFAULT_SCHEME_DARK,
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  THEMES,
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  themeHalf,
  type Element,
  type ThemeDefinition,
} from '@livediagram/document';

export type ColourField = 'fillColor' | 'strokeColor';

// What an element of this type paints when nothing sets the colour.
function typeDefault(el: Element, field: ColourField, surface: 'light' | 'dark'): string {
  if (el.type === 'arrow') return defaultArrowStrokeColor(surface);
  return field === 'fillColor' ? defaultFillColor(el, surface) : defaultStrokeColor(el, surface);
}

function themesOf(themeId: string | undefined): ThemeDefinition[] | null {
  if (themeId === undefined || themeId === DEFAULT_SCHEME_ID)
    return [DEFAULT_SCHEME_LIGHT, DEFAULT_SCHEME_DARK];
  const theme = THEMES.find((t) => t.id === themeId);
  // A theme paints in both its halves (docs/specs/011-theme/light-and-dark.md): the one it is written in and the one
  // derived from it, which is what an agent's write stores for a dark theme.
  return theme ? [themeHalf(theme, 'light'), themeHalf(theme, 'dark')] : null;
}

const lower = (colour: string) => colour.toLowerCase();

// Every colour the theme would paint in `field` on `el`, lower-cased; null for a custom theme.
export function themeColourSet(
  themeId: string | undefined,
  el: Element,
  field: ColourField,
): ReadonlySet<string> | null {
  const themes = themesOf(themeId);
  if (!themes) return null;
  const pick = field === 'fillColor' ? 'fill' : 'stroke';
  const colours = new Set<string>();
  for (const theme of themes) {
    const element = field === 'fillColor' ? theme.elementFill : theme.elementStroke;
    if (element) colours.add(lower(element));
    else
      for (const surface of ['light', 'dark'] as const)
        colours.add(lower(typeDefault(el, field, surface)));
    for (const entry of [...(theme.palette ?? []), ...(theme.rootColor ? [theme.rootColor] : [])])
      colours.add(lower(entry[pick]));
    // An override may set only some colours.
    Object.values(theme.shapeColors ?? {})
      .map((override) => override?.[pick])
      .filter((colour): colour is string => typeof colour === 'string')
      .forEach((colour) => colours.add(lower(colour)));
  }
  return colours;
}
