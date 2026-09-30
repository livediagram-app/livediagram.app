// STUB (plan 0002): replaced by the real builder in Phase 2.

import { createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID } from './template-layers';

export function buildStakeholderMap(cx: number, cy: number): Element[] {
  return [
    {
      ...createText(cx - 200, cy - 26),
      width: 400,
      height: 52,
      label: 'buildStakeholderMap',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
  ];
}
