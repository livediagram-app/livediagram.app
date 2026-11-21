'use client';

// An item's whole kit from its kinds registry (blueprint item-ui.md "The helper"; ui.md "The kit"): the registry's
// kinds as tiles, first forms and panels (kit-kinds.tsx); the sentence, the needs, the picks and the values from
// the registry's own words; the templates with their composed pictures; Test Rule, Run Rule and the Audit Trail's
// tab. The kinds every app has are drawn here; an app hands in only its own kinds' pictures and panels.
//
// Call it ONCE, at module level, in a module only the lazy screen imports: the kit it answers must be the same
// object from render to render, and nothing in `input` may change afterwards. What changes while the screen is
// open arrives through `input.useItem()`, which must answer the same object while nothing in it changed.

import {
  conditionWords,
  itemPicksLeft,
  itemRuleSentence,
  ruleNeeds,
  sentenceText,
  stepWords,
  triggerWords,
  type ItemPart,
  type ItemPick,
  type ItemRef,
  type ItemRun,
  type ItemTemplate,
} from '@liveworkspace/automations/item';
import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import { defineAutomationsKit, type AnyAutomationsKit } from '../kit';
import { HOOK_CODE } from '../step-panels/IncomingWebhookPanel';
import { isHolder, stepKey } from '../types';
import type { ItemListedRule } from './client';
import { ItemRunRule, runOffered } from './ItemRunRule';
import { itemTestRule } from './ItemTestRule';
import { buildItemKinds, freshMessage } from './kit-kinds';
import { makeUseItemOutline } from './outline';
import { itemValueGroups, ruleWantsTab, summarisedBefore } from './rule-reads';
import { ItemTemplateScene } from './scenes/ItemTemplateScene';
import { DEFAULT_TONE } from './scenes/tones';
import type { ItemAutomationsKitInput, ItemUiOutline } from './types';
import { ITEM_REFUSAL_PICKS, needWords, pickWords } from './words';

const NO_TRIGGER: ItemPart = { kind: '' };
const noRef = () => '';
const useNoRef = () => noRef;

/** The step a template ends by doing: its last, or the last action of an If / Else that ends it. */
export function lastStepOf(steps: readonly ItemPart[]): ItemPart | null {
  const last = steps[steps.length - 1];
  if (!last) return null;
  if (!isHolder(last)) return last;
  const inner = [...last.then, ...(last.else ?? [])];
  return (inner[inner.length - 1] as ItemPart | undefined) ?? last;
}

/** A template's trigger and last step, read by building it once over an empty item. */
export function templateShape(template: ItemTemplate): { trigger: string; step: string | null } {
  const { body } = template.build({ tabs: [], people: [], timeZone: 'UTC' });
  const step = lastStepOf(body.steps);
  return { trigger: body.trigger.kind, step: step ? stepKey(step) : null };
}

export function defineItemAutomationsKit(input: ItemAutomationsKitInput): AnyAutomationsKit {
  const { kinds: registry, plumbing } = input;
  const item = registry.itemWord;
  const built = buildItemKinds(input);
  const useOutline = makeUseItemOutline(input);

  const templates = new Map(input.templates.list.map((t) => [t.id, t]));
  // Each template's picture is worked out once, the first time its tile is drawn.
  const pictures = new Map<string, React.ReactNode>();
  const pictureOf = (id: string): React.ReactNode => {
    const held = pictures.get(id);
    if (held !== undefined) return held;
    const template = templates.get(id);
    const shape = template ? templateShape(template) : null;
    const trigger = shape ? built.triggerVignette(shape.trigger) : null;
    const drawn =
      trigger || input.templates.scenes?.[id] ? (
        <ItemTemplateScene
          tone={input.templates.tones?.[id] ?? trigger?.tone ?? DEFAULT_TONE}
          trigger={trigger?.scene ?? (() => null)}
          step={shape?.step ? built.actionVignette(shape.step) : null}
          scene={input.templates.scenes?.[id]}
        />
      ) : null;
    pictures.set(id, drawn);
    return drawn;
  };

  return defineAutomationsKit<
    ItemPart,
    ItemPart,
    ItemPart,
    ItemUiOutline,
    ItemListedRule,
    ItemRun,
    never
  >({
    plumbing,
    helpButton: input.helpButton,
    kinds: built.kinds,
    sentence: {
      rule: (rule, outline) => itemRuleSentence(rule, registry, outline.names),
      trigger: (trigger, outline) => triggerWords(registry, trigger, outline.names),
      condition: (condition, outline) =>
        sentenceText(conditionWords(registry, condition, outline.names)),
      step: (step, outline) => sentenceText(stepWords(registry, step, outline.names)),
      // An email's subject under its chip; a message step's text is the screen's to draw.
      text: (step) =>
        step.kind === 'email' && typeof step['subject'] === 'string'
          ? step['subject'] || null
          : null,
      picksLabel: 'Only If',
      // What the item lacks is known best here, where its snapshots, connections and templates are read: the api
      // checks tabs, people and snapshots alone. A list not read yet is not checked.
      attention: (rule, outline) => ruleNeeds(rule, outline.have),
      needs: (attention: readonly ItemRef[]) => needWords(attention),
      gone: (text) => text,
      refusalPicks: ITEM_REFUSAL_PICKS,
      pick: pickWords,
      picksLeft: (body, picks) =>
        itemPicksLeft(body, picks as readonly AutomationTemplatePickAt<ItemPick>[]),
    },
    useOutline,
    values: ({ body, step }) =>
      itemValueGroups(registry, {
        trigger: body?.trigger ?? NO_TRIGGER,
        afterAi: summarisedBefore(body, step),
      }),
    valuesLine: `Put a value of the ${item}, like its name or the tab’s, at the caret.`,
    templates: {
      list: input.templates.list,
      categories: input.templates.categories,
      build: (id, outline, timeZone) =>
        templates.get(id)?.build({
          tabs: outline.item.tabs,
          people: outline.item.people,
          timeZone,
        }) ?? null,
      scene: pictureOf,
    },
    Test: itemTestRule(registry),
    runRule: { offered: runOffered, Run: ItemRunRule },
    audit: {
      column: 'Tab',
      none: 'No tab',
      subjectOf: (run) => (run.subject ? { id: run.subject.id, title: run.subject.title } : null),
      useRef: useNoRef,
      open: { label: 'Open Tab', useGo: () => input.useItem().openTab },
    },
    messages: {
      fresh: freshMessage,
      hints: {
        webhook:
          'Sent as a signed JSON event with the rule and, when the run is about one, the tab.',
        slack: `Posted with a link that opens this ${item}, at the tab when the run is about one.`,
        teams: `Posted to the channel with a link that opens this ${item}, at the tab when the run is about one.`,
      },
    },
    incoming: {
      example: '{"tab": "Tab Name", "status": "green"}',
      howTo: (
        <>
          Send JSON, up to 16 KB. Name a tab in <code className={HOOK_CODE}>tab</code>, by its name
          or its id, to run the rule on it; anything else in the body is yours to read with Webhook
          Field values. Set <code className={HOOK_CODE}>SECRET</code> to the rule’s secret first.
        </>
      ),
      runsOn: (body) =>
        ruleWantsTab(body)
          ? 'The tab the call names. This rule reads the run’s tab, so the call should name one.'
          : `The tab the call names. With none named, it runs once on the ${item} alone.`,
      signatureHeader: input.signatureHeader,
    },
    connections: { client: input.indexClient, app: input.app, useSignInHref: input.useSignInHref },
    describe: input.describe,
  });
}
