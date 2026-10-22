// What a page's background edit is (docs/specs/007-editor/pages-mode.md
// "Backgrounds"): a patch laid over the page's background, fills compared by value, and the angle the
// page panel's gradients run at. Pure, shared by the page panel and the agents' page changes
// (docs/specs/024-agents/pages-for-agents.md); how a sheet is painted stays with the editor.
import type { Page, PageBackground, PageFill } from './page';
import { samePageImage } from './page-image';

// CSS degrees: 180 runs top to bottom, so 160 leans the run toward the bottom right.
export const PAGE_GRADIENT_ANGLE = 160;

/** Whether two fills are the same (a preset's swatch shows as chosen). */
export function sameFill(a: PageFill | undefined, b: PageFill | undefined): boolean {
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
  if (a.kind === 'image' && b.kind === 'image') return samePageImage(a, b);
  return false;
}

/** The page with `patch` laid over its background (a hover preview, or an edit about to land). */
export function withBackgroundPatch(
  page: Page,
  patch: Partial<PageBackground> | undefined,
): PageBackground | undefined {
  if (!patch) return page.background;
  const merged: PageBackground = { ...page.background, ...patch };
  if (!merged.fill) delete merged.fill;
  if (!merged.pattern) delete merged.pattern;
  return merged.fill || merged.pattern ? merged : undefined;
}
