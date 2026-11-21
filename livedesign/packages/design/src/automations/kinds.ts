// livedesign's Automations kinds (docs/specs/013-workspace/automations.md; blueprint automations.md "Kinds"): the
// triggers, conditions, steps and values every app has, the comment and action triggers, Add a Tab from a Template,
// and this app's own. One registry: the api's room, its routes, the editor's builder and the agents' tools all read
// this value. Pure, so it runs in a browser as in a Worker.

import { defineItemKinds, type ItemKinds } from '@liveworkspace/automations/item';
import { COMPONENT_REF, DESIGN_TRIGGERS } from './triggers';
import { DESIGN_VALUES } from './values';

export const KINDS: ItemKinds = defineItemKinds({
  itemWord: 'design',
  collab: true,
  tabTemplates: true,
  triggers: DESIGN_TRIGGERS,
  values: DESIGN_VALUES,
  ownRefs: [COMPONENT_REF],
});

// The telemetry category a design's runs are counted under (docs/specs/017-telemetry/telemetry.md): the shared
// `Document` category every product's dashboard reads its items' events from, as Joined is.
export const AUTOMATIONS_TELEMETRY_CATEGORY = 'Document';
