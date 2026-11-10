// One copy for every product: @liveworkspace/element-model/svg-render-web.
export * from '@liveworkspace/element-model/svg-render-web';
import {
  svgWebComponent as sharedSvgWebComponent,
  type WebFaceOptions,
} from '@liveworkspace/element-model/svg-render-web';
import type { BoxedElement } from './index';
import { svgQuote } from './svg-render-quote';
import { statTrend, statTrendColours } from './stat-count';
import { STAT_VALUE_MAX_PX } from './web-components';

type Shape = BoxedElement & { type: 'shape' };

/** The body of a web component shape in livedocuments, or '' for any other kind: the shared faces, plus the quote
 *  (docs/specs/009-elements/quote.md) and a stat row's stacked lines and change pill (docs/specs/009-elements/stat-row.md). */
export function svgWebComponent(el: Shape, o: WebFaceOptions): string {
  if (el.shape === 'quote') return svgQuote(el, o);
  const surface = o.surface ?? 'light';
  return sharedSvgWebComponent(el, {
    ...o,
    statChange: {
      valueMaxPx: STAT_VALUE_MAX_PX,
      colours: (change, ground, ink) => statTrendColours(statTrend(change), surface, ground, ink),
    },
  });
}
