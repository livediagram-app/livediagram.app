// livedesign's own triggers (docs/specs/013-workspace/automations.md "Triggers of its own"; blueprint automations.md
// "Kinds"): Component Changed and Agent Made Changes, each one definition beside the ones every app has
// (@liveworkspace/automations/item). The room queues their events (apps/api design-room/automations/); what each
// event carries is named here so the two never drift. Pure.

import { id, type Obj } from '@liveworkspace/automations';
import {
  agentChangedTrigger,
  defineTrigger,
  eventWho,
  type ItemEvent,
  type ItemOwnRef,
  type ItemPart,
  type TriggerKind,
} from '@liveworkspace/automations/item';
import { COMPONENT_NAME_MAX } from '../components';

// The event kind the room queues for a main component's change, and the keys of what it carries (an event's `data`).
export const COMPONENT_CHANGED_EVENT = 'component_changed';
export const COMPONENT_ID_DATA = 'component.id';
export const COMPONENT_NAME_DATA = 'component.name';

// How long the library stays quiet before a burst of changes is one run: 2 minutes, the spec's.
export const COMPONENT_QUIET_MS = 2 * 60_000;

// A main component of the design's library, as a rule names one: by id, in Component Changed's `component` field.
// livedesign's own reference (item-engine.md "References"): a copy, a file and a Describe a Rule draft leave it to
// pick, and the Rules list says when the component is gone (the kit's `owns`).
export const COMPONENT_REF: ItemOwnRef = {
  field: 'component',
  noun: 'a component',
  title: 'Component',
};

// `component`: the one main the rule keeps to (absent: any); `name` its name when the rule was saved, for the words
// where the library is not at hand.
export type ComponentChangedTrigger = {
  kind: typeof COMPONENT_CHANGED_EVENT;
  component?: string;
  name?: string;
};

/** The component a trigger keeps to, in words: its name as the rule kept it, or that it is still to pick. */
export const componentWords = (t: Pick<ComponentChangedTrigger, 'component' | 'name'>): string =>
  t.component === '' ? COMPONENT_REF.noun : t.name ? `“${t.name}”` : 'a component';

// What the event names: the component's name it carried, else any.
const changedName = (event: ItemEvent): string => {
  const name = event.data?.[COMPONENT_NAME_DATA];
  return typeof name === 'string' && name ? `“${name}”` : 'a component';
};

function readComponent(value: Obj, path: string): Partial<ComponentChangedTrigger> {
  if (value['component'] === undefined) return {};
  const name = value['name'];
  return {
    component: id(value['component'], `${path}.component`),
    ...(typeof name === 'string' && name.trim()
      ? { name: [...name.trim()].slice(0, COMPONENT_NAME_MAX).join('') }
      : {}),
  };
}

const componentChanged = defineTrigger<ComponentChangedTrigger & ItemPart>({
  kind: COMPONENT_CHANGED_EVENT,
  name: 'Component Changed',
  group: 'Components',
  line: 'a main component of the library changes, then nothing changes for 2 minutes',
  format:
    '{"kind":"component_changed","component"?:a main component’s id,"name"?:its name} (a main component of the ' +
    'library changed, then 2 minutes passed with no other change; once per burst, never for a rule’s own changes; ' +
    'the last one changed reads as {{component.name}})',
  // Heard only as the start of a quiet stretch, as Edited, Then Quiet is.
  hears: [],
  read: (value, path) => ({ kind: COMPONENT_CHANGED_EVENT, ...readComponent(value, path) }),
  defaults: () => ({ kind: COMPONENT_CHANGED_EVENT }),
  matches: (trigger, event) =>
    trigger.component === undefined || event.data?.[COMPONENT_ID_DATA] === trigger.component,
  words: (trigger) => [
    { chip: 'Component Changed', trigger: true },
    ...(trigger.component === undefined
      ? []
      : [{ word: 'for' }, { chip: componentWords(trigger) }]),
  ],
  said: (_trigger, event) => `${eventWho(event)} changed ${changedName(event)}`,
  settle: {
    after: [COMPONENT_CHANGED_EVENT],
    quietMs: () => COMPONENT_QUIET_MS,
    // A rule kept to one component settles on it; any other on the whole library, so a burst over several mains is
    // one run.
    key: (_event, trigger) => trigger.component ?? '',
  },
});

const agentChanged = agentChangedTrigger({
  line: 'an agent changes the canvas, its pages or a component through the MCP server, the CLI or the API',
  note:
    'an agent, through an API token, changes a tab’s canvas or pages, or a main component; once per write, ' +
    '{{person}} is the token’s name',
});

/** livedesign's own triggers, in the picker's order. */
export const DESIGN_TRIGGERS: readonly TriggerKind[] = [componentChanged, agentChanged];
