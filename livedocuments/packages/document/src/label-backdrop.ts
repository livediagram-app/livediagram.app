// What is drawn behind a label, and keeping a label readable on it when a theme or the dark editor repaints one without
// the other (docs/specs/011-theme/light-and-dark.md "A theme never sinks a label into what is behind it"). The rules
// are every product's (@liveworkspace/model-core/label-backdrop); this binds them to this package's colours. Pure.
import { labelInks } from '@liveworkspace/model-core/label-backdrop';
import { canvasSurface, contrastRatio, defaultFillColor, defaultTextColor } from './colors';
import { reachContrast } from './readable-colour';
import type { BoxedElement, Element } from './index';

export { LABEL_BACKDROP_CONTRAST } from '@liveworkspace/model-core/label-backdrop';

export const { labelBackdrops, withReadableLabelInks } = labelInks<Element>({
  canvasSurface,
  contrastRatio,
  reachContrast,
  defaultFillColor: (el, surface) => defaultFillColor(el as BoxedElement, surface),
  defaultTextColor: (el, surface) => defaultTextColor(el as BoxedElement, surface),
});
