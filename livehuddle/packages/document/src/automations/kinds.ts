// livehuddle's Automations kinds (docs/specs/013-workspace/automations.md; blueprint automations.md "Kinds"): the
// triggers, conditions, steps and values every app has, Add a Tab from a Template, and this app's own. livehuddle has
// no comment threads or actions, so no comment or action trigger. One registry: the api's room, its routes and the
// editor's builder all read this value. Pure, so it runs in a browser as in a Worker.

import { defineItemKinds, type ItemKinds } from '@liveworkspace/automations/item';
import { SPACE_ACTIONS } from './actions';
import { SPACE_TRIGGERS } from './triggers';
import { SPACE_VALUES } from './values';

export const KINDS: ItemKinds = defineItemKinds({
  itemWord: 'Space',
  collab: false,
  tabTemplates: true,
  triggers: SPACE_TRIGGERS,
  actions: SPACE_ACTIONS,
  values: SPACE_VALUES,
});

// The telemetry category a Space's runs are counted under: every Space event's (docs/specs/017-telemetry/telemetry.md).
export const AUTOMATIONS_TELEMETRY_CATEGORY = 'Document';
