// liveknowledge's Automations kinds (docs/specs/013-workspace/automations.md; blueprint automations.md "Kinds"): the
// triggers, conditions, steps and values every app has, in a knowledgebase's words (its tabs are pages), the comment
// and action triggers, Add a Page from a Template, and this app's own. One registry: the api's room, its routes, the editor's builder and the agents' tools all read
// this value. Pure, so it runs in a browser as in a Worker.

import { defineItemKinds, type ItemKinds } from '@liveworkspace/automations/item';
import { DOCUMENT_ACTIONS, VERSION_REF } from './actions';
import { DOCUMENT_TRIGGERS } from './triggers';
import { DOCUMENT_VALUES } from './values';

export const KINDS: ItemKinds = defineItemKinds({
  itemWord: 'knowledgebase',
  collab: true,
  tabTemplates: true,
  triggers: DOCUMENT_TRIGGERS,
  actions: DOCUMENT_ACTIONS,
  values: DOCUMENT_VALUES,
  ownRefs: [VERSION_REF],
});

// The telemetry category a document's runs are counted under (docs/specs/017-telemetry/telemetry.md).
export const AUTOMATIONS_TELEMETRY_CATEGORY = 'Document';
