// STUB (plan 0002): replaced by the real builder in Phase 2.

import { createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID } from './template-layers';

export function buildIncidentPostmortem(cx: number, cy: number): Element[] {
  return [
    {
      ...createText(cx - 200, cy - 26),
      width: 400,
      height: 52,
      label: 'buildIncidentPostmortem',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
  ];
}
