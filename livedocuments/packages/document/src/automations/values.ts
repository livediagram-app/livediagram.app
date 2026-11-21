// livedocuments' own values (docs/specs/013-workspace/automations.md "Values of its own"): what a Version Named and
// a Version Restored rule's text may read, from the event the room queued (triggers.ts names the key). Pure.

import type { ValueKind } from '@liveworkspace/automations/item';
import { VERSION_NAMED_EVENT, VERSION_NAME_DATA, VERSION_RESTORED_EVENT } from './triggers';

/** livedocuments' own values, in the order Insert a Value lists them. */
export const DOCUMENT_VALUES: readonly ValueKind[] = [
  {
    name: 'version.name',
    label: 'Version Name',
    under: [VERSION_NAMED_EVENT, VERSION_RESTORED_EVENT],
    fill: (ctx) => {
      const value = ctx.event.data?.[VERSION_NAME_DATA];
      return value === undefined ? '' : String(value);
    },
  },
];
