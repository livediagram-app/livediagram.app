// What a page's background edit is (each pages product's pages-mode spec, "Backgrounds"): a patch laid over the
// page's background, fills compared by value, and the angle the page panel's gradients run at. Pure, shared by the
// page panel and the agents' page changes of livedesign and livedocuments; each compares its own pictures.
import type { PageColourFill } from './index';

// CSS degrees: 180 runs top to bottom, so 160 leans the run toward the bottom right.
export const PAGE_GRADIENT_ANGLE = 160;

/** Whether two fills are the same (a preset's swatch shows as chosen); two pictures by the product's `sameImage`. */
export function sameFill<I extends { kind: 'image' }>(
  a: PageColourFill | I | undefined,
  b: PageColourFill | I | undefined,
  sameImage: (a: I, b: I) => boolean,
): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind === 'solid' && b.kind === 'solid')
    return a.color.toLowerCase() === b.color.toLowerCase();
  if (a.kind === 'gradient' && b.kind === 'gradient') {
    return (
      a.from === b.from &&
      a.to === b.to &&
      a.angle === b.angle &&
      a.motion === b.motion &&
      (a.speed ?? 1) === (b.speed ?? 1)
    );
  }
  if (a.kind === 'image' && b.kind === 'image') return sameImage(a as I, b as I);
  return false;
}

/** The page with `patch` laid over its background (a hover preview, or an edit about to land). */
export function withBackgroundPatch<B extends { fill?: unknown; pattern?: unknown }>(
  page: { background?: B },
  patch: Partial<B> | undefined,
): B | undefined {
  if (!patch) return page.background;
  const merged = { ...page.background, ...patch } as B;
  if (!merged.fill) delete merged.fill;
  if (!merged.pattern) delete merged.pattern;
  return merged.fill || merged.pattern ? merged : undefined;
}
