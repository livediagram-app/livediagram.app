// livedesign's own values (docs/specs/013-workspace/automations.md "Values of its own"): what a Component Changed
// rule's text may read, from the event the room queued (triggers.ts names the key). Pure.

import type { ValueKind } from '@liveworkspace/automations/item';
import { COMPONENT_CHANGED_EVENT, COMPONENT_NAME_DATA } from './triggers';

/** livedesign's own values, in the order Insert a Value lists them. */
export const DESIGN_VALUES: readonly ValueKind[] = [
  {
    name: 'component.name',
    label: 'Component Name',
    under: [COMPONENT_CHANGED_EVENT],
    fill: (ctx) => {
      const value = ctx.event.data?.[COMPONENT_NAME_DATA];
      return value === undefined ? '' : String(value);
    },
  },
];
