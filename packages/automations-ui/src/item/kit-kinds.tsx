'use client';

// The registry as the pickers and the builder take it (blueprint item-ui.md "Kinds", "Panels", "Pictures"): each
// trigger, condition and action the app's `ItemKinds` holds, as a tile (name, line, picture), a first form and a
// panel. The kinds every app has get theirs here; an app's own get the picture and panel it handed in.

import {
  AUTOMATION_NOTIFY_NAMES,
  type AutomationOutgoing,
  type AutomationVia,
} from '@liveworkspace/automations';
import {
  sharedActions,
  sharedConditions,
  sharedTriggers,
  type ItemKinds,
  type ItemPart,
} from '@liveworkspace/automations/item';
import type { ComponentType } from 'react';
import type {
  ActionKind,
  ActionPanelProps,
  AutomationsKinds,
  ConditionKind,
  ConditionPanelProps,
  KindGroup,
  TriggerKind,
  TriggerPanelProps,
} from '../kit';
import { ScheduledPanel } from '../step-panels/ScheduledPanel';
import { TONES, TileStage, type SceneTone } from '../tile-picker/tile-scene';
import { ITEM_ACTION_GLYPHS } from './glyphs';
import { AddTabPanel, ItemEmailPanel, summarisePanel } from './panels/action-panels';
import {
  TabConditionPanel,
  WeekdayConditionPanel,
  WhoConditionPanel,
  textConditionPanel,
} from './panels/condition-panels';
import { RevertSnapshotPanel, TakeSnapshotPanel } from './panels/snapshot-panels';
import {
  EditedPanel,
  ItemIncomingPanel,
  NotEditedPanel,
  TabTriggerPanel,
  startsWhenPanel,
} from './panels/trigger-panels';
import {
  MESSAGE_KEYS,
  SUMMARISE_KEY,
  actionGroupsOf,
  groupId,
  triggerGroupsOf,
} from './rule-reads';
import { ACTION_SCENES } from './scenes/action-scenes';
import { ACTION_GROUP_TONES, DEFAULT_TONE, TRIGGER_GROUP_TONES } from './scenes/tones';
import { TRIGGER_SCENES } from './scenes/trigger-scenes';
import type { ItemAutomationsKitInput, ItemUiOutline, ItemVignette } from './types';
import { sharedActionLines, sharedTriggerLines, startsWhen, tileLine } from './words';

type Trigger = TriggerKind<ItemPart, ItemUiOutline>;
type Condition = ConditionKind<ItemPart, ItemUiOutline>;
type Action = ActionKind<ItemPart, ItemUiOutline>;
type TriggerPanel = ComponentType<TriggerPanelProps<ItemPart, ItemUiOutline>>;
type ConditionPanel = ComponentType<ConditionPanelProps<ItemPart, ItemUiOutline>>;
type ActionPanel = ComponentType<ActionPanelProps<ItemPart, ItemUiOutline>>;

// A panel written over its own part's shape, as the kit holds it (over any part). The builder hands a panel only
// the parts of its own kind, which is what makes the widening sound.
const panel = <Held,>(component: unknown): Held => component as Held;

// The kinds every app has: whatever else the registry holds is the app's own.
const SHARED_TRIGGERS: ReadonlySet<string> = new Set(sharedTriggers(true).map((k) => k.kind));
const SHARED_CONDITIONS: ReadonlySet<string> = new Set(sharedConditions().map((k) => k.kind));
const SHARED_ACTIONS: ReadonlySet<string> = new Set(sharedActions(true).map((k) => k.kind));

// The comment triggers that may be kept to one tab.
const TAB_TRIGGERS: ReadonlySet<string> = new Set([
  'comment_added',
  'thread_resolved',
  'threads_resolved',
]);

const RUN_BY_HAND =
  'Starts when an Editor presses Run Rule: on this rule’s row in the Rules list, or in its ⋯ menu.';

/** What a message step starts as, by where it posts: no connection picked yet. */
export const freshMessage = (via: AutomationVia): AutomationOutgoing => ({
  kind: 'notify',
  via,
  webhook: '',
  text: '{{rule}} ran in {{item.name}}.',
});

// A picker's tile picture: the vignette on its stage, in its group's tone.
const staged = (vignette: ItemVignette, toneOf: (group: string) => SceneTone) =>
  function scene(group: string) {
    const tone = TONES[toneOf(group)];
    return <TileStage tone={tone}>{vignette({ tone })}</TileStage>;
  };

// A group's tone by its id: the shared groups' own, then the app's (named by the group's name), then violet.
function tonesOf(
  shared: Readonly<Record<string, SceneTone>>,
  own: Readonly<Record<string, SceneTone>> = {},
): (group: string) => SceneTone {
  const named = new Map(Object.entries(own).map(([name, tone]) => [groupId(name), tone]));
  return (group) => shared[group] ?? named.get(group) ?? DEFAULT_TONE;
}

function refuseStray(
  what: string,
  own: Readonly<Record<string, unknown>> | undefined,
  known: (kind: string) => boolean,
  shared: ReadonlySet<string>,
): void {
  for (const kind of Object.keys(own ?? {})) {
    if (shared.has(kind))
      throw new Error(
        `automations: "${kind}" is a shared ${what}; own.${what}s takes the app's own kinds only`,
      );
    if (!known(kind))
      throw new Error(`automations: own.${what}s names "${kind}", which the registry lacks`);
  }
}

export interface ItemKitKinds {
  kinds: AutomationsKinds<ItemPart, ItemPart, ItemPart, ItemUiOutline>;
  /** A trigger's vignette and tone, for a template's picture. */
  triggerVignette: (kind: string) => { scene: ItemVignette; tone: SceneTone } | null;
  /** A step's vignette by its tile key. */
  actionVignette: (key: string) => ItemVignette | null;
}

export function buildItemKinds(
  input: Pick<ItemAutomationsKitInput, 'kinds' | 'own' | 'firstTrigger' | 'tabTemplates'>,
): ItemKitKinds {
  const registry: ItemKinds = input.kinds;
  const own = input.own ?? {};
  const item = registry.itemWord;
  refuseStray('trigger', own.triggers, (k) => !!registry.trigger(k), SHARED_TRIGGERS);
  refuseStray('condition', own.conditions, (k) => !!registry.condition(k), SHARED_CONDITIONS);
  refuseStray('action', own.actions, (k) => !!registry.action(k), SHARED_ACTIONS);

  // ---- Triggers ----
  const triggerGroups = triggerGroupsOf(registry);
  const triggerTone = tonesOf(TRIGGER_GROUP_TONES, own.tones);
  const triggerLines = sharedTriggerLines(item);
  const triggerScenes = new Map<string, ItemVignette>();
  const triggers: Record<string, Trigger> = {};
  for (const def of registry.triggers) {
    const shared = SHARED_TRIGGERS.has(def.kind);
    const mine = own.triggers?.[def.kind];
    const vignette = shared ? TRIGGER_SCENES[def.kind] : mine?.scene;
    if (!vignette) throw new Error(`automations: no picture for the trigger "${def.kind}"`);
    triggerScenes.set(def.kind, vignette);
    const Panel: TriggerPanel = !shared
      ? (mine?.Panel ?? startsWhenPanel(startsWhen(def.line)))
      : def.kind === 'scheduled'
        ? panel<TriggerPanel>(ScheduledPanel)
        : def.kind === 'incoming_webhook'
          ? ItemIncomingPanel
          : def.kind === 'edited'
            ? panel<TriggerPanel>(EditedPanel)
            : def.kind === 'not_edited'
              ? panel<TriggerPanel>(NotEditedPanel)
              : TAB_TRIGGERS.has(def.kind)
                ? panel<TriggerPanel>(TabTriggerPanel)
                : startsWhenPanel(def.kind === 'manual' ? RUN_BY_HAND : startsWhen(def.line));
    triggers[def.kind] = {
      name: def.name,
      line: (shared && triggerLines[def.kind]) || tileLine(def.line),
      ...(def.time ? { time: true } : {}),
      ...(def.personless ? { personless: true } : {}),
      scene: staged(vignette, triggerTone),
      // From one tab trigger to another, the tab it is kept to stays.
      fresh: (outline, from) => {
        const fresh = def.defaults();
        const tab = from?.['tab'];
        return TAB_TRIGGERS.has(def.kind) &&
          typeof tab === 'string' &&
          outline.item.tabs.some((t) => t.id === tab)
          ? { ...fresh, tab }
          : fresh;
      },
      Panel,
    };
  }

  // ---- Conditions ----
  const TextPanel = textConditionPanel(registry);
  const conditionPanels: Readonly<Record<string, ConditionPanel>> = {
    tab: panel<ConditionPanel>(TabConditionPanel),
    who: panel<ConditionPanel>(WhoConditionPanel),
    weekday: panel<ConditionPanel>(WeekdayConditionPanel),
    text: panel<ConditionPanel>(TextPanel),
  };
  const conditions: Record<string, Condition> = {};
  for (const def of registry.conditions) {
    const shared = SHARED_CONDITIONS.has(def.kind);
    const Panel = shared ? conditionPanels[def.kind] : own.conditions?.[def.kind]?.Panel;
    conditions[def.kind] = {
      name: def.name,
      ...(def.personal ? { personal: true } : {}),
      fresh: (outline) => {
        const fresh = def.defaults();
        // Tab starts on the tab the person is on; Who Did It on an Editor: neither may be saved empty.
        if (shared && def.kind === 'tab') {
          const { tabs, currentTabId } = outline.item;
          const first = tabs.find((t) => t.id === currentTabId) ?? tabs[0];
          return { ...fresh, tabs: first ? [first.id] : [] };
        }
        if (shared && def.kind === 'who') return { ...fresh, who: [{ role: 'editor' }] };
        return fresh;
      },
      ...(Panel ? { Panel } : {}),
    };
  }

  // ---- Actions ----
  const actionGroups: KindGroup[] = actionGroupsOf(registry);
  const actionTone = tonesOf(ACTION_GROUP_TONES, own.tones);
  const actionLines = sharedActionLines(item);
  const SummarisePanel = summarisePanel(registry);
  const actionPanels: Readonly<Record<string, ActionPanel>> = {
    take_snapshot: panel<ActionPanel>(TakeSnapshotPanel),
    revert_snapshot: panel<ActionPanel>(RevertSnapshotPanel),
    email: panel<ActionPanel>(ItemEmailPanel),
    add_tab: panel<ActionPanel>(AddTabPanel),
    [SUMMARISE_KEY]: panel<ActionPanel>(SummarisePanel),
  };
  const firstForms: Readonly<
    Record<string, (outline: ItemUiOutline, fresh: ItemPart) => ItemPart>
  > = {
    email: (_outline, fresh) => ({
      ...fresh,
      subject: '{{item.name}}',
      body: '{{rule}} ran in {{item.name}}.\n{{item.url}}',
    }),
    add_tab: (outline, fresh) => ({
      ...fresh,
      template: outline.templates[0]?.id ?? '',
      name: outline.templates[0]?.name ?? 'New Tab',
    }),
  };
  const actionScenes = new Map<string, ItemVignette>();
  const actions: Record<string, Action> = {};
  const tile = (key: string, kind: string, over: Partial<Action> = {}) => {
    const def = registry.action(kind)!;
    const shared = SHARED_ACTIONS.has(kind);
    const mine = own.actions?.[kind];
    const vignette = shared ? ACTION_SCENES[key] : mine?.scene;
    const glyph = shared ? ITEM_ACTION_GLYPHS[key] : mine?.glyph;
    if (!vignette || !glyph) throw new Error(`automations: no picture for the action "${kind}"`);
    actionScenes.set(key, vignette);
    const Panel = shared ? actionPanels[key] : mine?.Panel;
    const first = shared ? firstForms[key] : undefined;
    actions[key] = {
      name: def.name,
      line: (shared && actionLines[key]) || tileLine(def.line),
      glyph,
      scene: staged(vignette, actionTone),
      fresh: (outline) => (first ? first(outline, def.defaults()) : def.defaults()),
      ...(Panel ? { Panel } : shared ? {} : { note: mine?.note ?? tileLine(def.line) }),
      ...(def.top ? { top: true } : {}),
      ...(def.last ? { last: true } : {}),
      ...over,
    };
  };
  for (const def of registry.actions) {
    if (def.kind === 'if') continue;
    if (def.kind === 'notify')
      for (const key of MESSAGE_KEYS) {
        const via = key.slice('notify_'.length) as AutomationVia;
        tile(key, 'notify', { name: AUTOMATION_NOTIFY_NAMES[via], fresh: () => freshMessage(via) });
      }
    else if (def.kind === 'ai') tile(SUMMARISE_KEY, 'ai');
    else tile(def.kind, def.kind);
  }

  return {
    kinds: {
      triggerGroups,
      triggerHint: 'Try another word, such as “edited”, “tab” or “snapshot”.',
      triggers,
      triggerOrder: triggerGroups.flatMap((g) => [...g.kinds]),
      firstTrigger: input.firstTrigger ?? 'edited',
      conditions,
      actionGroups,
      actionHint: 'Try another word, such as “snapshot”, “email” or “Slack”.',
      actions,
    },
    triggerVignette: (kind) => {
      const scene = triggerScenes.get(kind);
      const def = registry.trigger(kind);
      return scene && def ? { scene, tone: triggerTone(groupId(def.group)) } : null;
    },
    actionVignette: (key) => actionScenes.get(key) ?? null,
  };
}
