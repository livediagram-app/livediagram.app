// livedocuments' own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint
// automations.md "Kinds"): Version Named, Version Restored and Agent Made Changes, each one definition beside the
// ones every app has (@liveworkspace/automations/item). The room queues their events (apps/api
// document-room/automations/); what each event carries is named here so the two never drift. Pure.

import { defineEventTrigger, type TriggerKind } from '@liveworkspace/automations/item';

// The event kinds the room queues, and the key of what the version triggers carry (an event's `data`).
export const VERSION_NAMED_EVENT = 'version_named';
export const VERSION_RESTORED_EVENT = 'version_restored';
export const AGENT_CHANGED_EVENT = 'agent_changed';
export const VERSION_NAME_DATA = 'version.name';

const versionNamed = defineEventTrigger({
  kind: VERSION_NAMED_EVENT,
  name: 'Version Named',
  group: 'Versions',
  line: 'someone names a version of a tab',
  note: 'someone names a version of a tab; its name reads as {{version.name}}',
  picksTab: true,
  tabbed: true,
  said: (who, tab) => `${who} named a version of ${tab}`,
});

const versionRestored = defineEventTrigger({
  kind: VERSION_RESTORED_EVENT,
  name: 'Version Restored',
  group: 'Versions',
  line: 'someone restores a tab to an earlier version',
  note: 'someone restores a tab to an earlier version; its name, when it has one, reads as {{version.name}}',
  picksTab: true,
  tabbed: true,
  said: (who, tab) => `${who} restored a version of ${tab}`,
});

const agentChanged = defineEventTrigger({
  kind: AGENT_CHANGED_EVENT,
  name: 'Agent Made Changes',
  line: 'an agent changes pages or writes an article through the MCP server, the CLI or the API',
  note:
    'an agent, through an API token, changes a tab’s pages or writes an article; once per write, {{person}} is ' +
    'the token’s name',
  picksTab: true,
  tabbed: true,
  said: (who, tab) => `${who} changed ${tab}`,
});

/** livedocuments' own triggers, in the picker's order. */
export const DOCUMENT_TRIGGERS: readonly TriggerKind[] = [
  versionNamed,
  versionRestored,
  agentChanged,
];
