// Parts the logo layouts share (docs/specs/007-editor/pages-mode.md "Layouts"): a disc with an icon in it.
import type { Kit } from './page-layout-kit';

// A disc with an icon set in it: a circle and the icon over its middle, half its size.
export function iconDisc(k: Kit, x: number, y: number, d: number, iconId: string) {
  const icon = d * 0.5;
  const disc = k.shape('circle', x, y, d, d, { label: '' });
  return {
    disc,
    els: [disc, k.shape('icon', x + (d - icon) / 2, y + (d - icon) / 2, icon, icon, { iconId })],
  };
}
