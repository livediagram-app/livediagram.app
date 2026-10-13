// Page backgrounds follow the theme (docs/specs/007-editor/illustrate-pages.md "Backgrounds"): a
// page whose fill is one of the old theme's own (a Theme gradient, the default Mist, an animated
// colouring, a Theme Palette colour) takes the same one from the new theme when the tab's theme
// changes. A colour someone picked that is not the theme's stays as it is, as an element's does.
// Content on a page whose fill changed is re-inked for it, as any fill change re-inks. Pure.
import {
  illustratePagesOf,
  pageInkFor,
  sameFill,
  withIllustratePages,
  type PageFill,
  type Tab,
  type ThemeDefinition,
} from '@livediagram/document';
import { themeBackgroundPresets } from './illustrate-page-paint';
import { colouringOf, motionFill } from './page-motion';
import { themePresetColors } from './themes';

type Theme = ThemeDefinition;

const isWhite = (c: string) => /^#?f{3}(?:f{3})?$/i.test(c);

/** The new theme's fill for a fill of the old theme's own, or undefined when the fill is not the
 *  old theme's (someone's own pick, a picture). */
export function followedFill(fill: PageFill, prev: Theme, next: Theme): PageFill | undefined {
  if (fill.kind === 'gradient' && fill.motion) {
    const colouring = colouringOf(prev, fill);
    return colouring ? motionFill(next, fill.motion, colouring) : undefined;
  }
  if (fill.kind === 'gradient') {
    const from = themeBackgroundPresets(prev).find((p) => sameFill(p.fill, fill));
    return from ? themeBackgroundPresets(next).find((p) => p.id === from.id)?.fill : undefined;
  }
  if (fill.kind === 'solid') {
    const before = themePresetColors(prev).filter((c) => !isWhite(c));
    const i = before.findIndex((c) => c.toLowerCase() === fill.color.toLowerCase());
    const after = themePresetColors(next).filter((c) => !isWhite(c));
    return i >= 0 && after[i] ? { kind: 'solid', color: after[i]! } : undefined;
  }
  return undefined;
}

/** The tab with every page on a fill of the old theme's own moved to the new theme's, its content
 *  re-inked; the same tab when no page changes. */
export function withPageBackgroundsFollowingTheme(tab: Tab, prev: Theme, next: Theme): Tab {
  const pages = illustratePagesOf(tab);
  if (!pages.some((p) => p.background?.fill)) return tab;
  const moved: string[] = [];
  const nextPages = pages.map((p) => {
    const fill = p.background?.fill;
    const to = fill ? followedFill(fill, prev, next) : undefined;
    if (!to || sameFill(to, fill)) return p;
    moved.push(p.id);
    return { ...p, background: { ...p.background, fill: to } };
  });
  if (moved.length === 0) return tab;
  let out = withIllustratePages(tab, nextPages) as Tab;
  for (const id of moved) {
    const background = nextPages.find((p) => p.id === id)!.background;
    out = pageInkFor(out, id, background).tab;
  }
  return out;
}
