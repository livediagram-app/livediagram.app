// What a page's background edit is (docs/specs/007-editor/pages-mode.md "Backgrounds"): one copy for every product
// with pages, @liveworkspace/page-background/page-paint, its fills' pictures compared by this model's own check.
import { sameFill as sameFillBy } from '@liveworkspace/page-background/page-paint';
import type { PageFill } from './page';
import { samePageImage } from './page-image';

export { PAGE_GRADIENT_ANGLE, withBackgroundPatch } from '@liveworkspace/page-background/page-paint';

/** Whether two fills are the same (a preset's swatch shows as chosen). */
export function sameFill(a: PageFill | undefined, b: PageFill | undefined): boolean {
  return sameFillBy(a, b, samePageImage);
}
