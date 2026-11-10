// One copy for every product: @liveworkspace/element-model/svg-render-table.
export * from '@liveworkspace/element-model/svg-render-table';
import { svgTableShape as sharedSvgTableShape } from '@liveworkspace/element-model/svg-render-table';
import type { CanvasSurface } from './colors';
import type { TableElement } from './index';

/** livedocuments' tables are comparison tables too (docs/specs/009-elements/comparison-tables.md): a tick or cross
 *  cell draws as a mark, and the highlighted column is painted. The other products draw the shared grid alone. */
export function svgTableShape(el: TableElement, surface: CanvasSurface = 'light'): string {
  return sharedSvgTableShape(el, surface, { comparison: true });
}
