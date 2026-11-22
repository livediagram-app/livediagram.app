// What an app's Templates gallery is built from, for an item's rules (blueprint item-engine.md "Templates and
// files"): stage 1's template over the item's names, with a pick for each reference a template leaves empty. The
// package ships no template: each app lists its own. Pure.

import {
  picksLeft,
  type AutomationTemplate,
  type AutomationTemplatePickAt,
  type TemplateStepLists,
} from '../templates';
import type { ItemRefKind } from './names';
import { refsOf } from './refs';
import type { ItemIf, ItemOutline, ItemPart, ItemRuleBody } from './types';

// A step in another app's target (cross-app/kinds.ts) is a pick too: the plan, knowledgebase, Space or document
// it acts on is the person's, as only they know what they can edit.
export type ItemPick = ItemRefKind | 'target';

/** What a template leaves to pick of a step in another app: its target, while it names no item. */
export const CROSS_APP_TARGET_PICK: ItemPick = 'target';
const emptyTarget = (part: unknown): boolean => {
  const target = (part as { target?: unknown } | null)?.target;
  return (
    typeof target === 'object' && target !== null && (target as { item?: unknown }).item === ''
  );
};

// What a template reads of the item it opens in.
export interface ItemTemplateItem {
  tabs: ItemOutline['tabs'];
  people: ItemOutline['people'];
  // The time zone the rule will be saved in.
  timeZone: string;
}

export type ItemTemplate<
  Id extends string = string,
  Category extends string = string,
> = AutomationTemplate<Id, Category, ItemTemplateItem, ItemRuleBody, ItemPick>;

/** An If / Else's lists, for a pick's path into one (`steps.0.then.1`). */
export const itemStepLists: TemplateStepLists<ItemPart> = (step, list) =>
  step.kind === 'if' && (list === 'then' || list === 'else')
    ? (step as unknown as ItemIf)[list]
    : undefined;

const empties = (part: unknown): ItemPick[] => [
  ...refsOf(part)
    .filter((ref) => ref.id === '')
    .map((ref) => ref.kind),
  ...(emptyTarget(part) ? [CROSS_APP_TARGET_PICK] : []),
];

/** Every reference `body` leaves empty, by the path of the part that holds it: a template's picks, a draft's, a
 *  copy's. An If / Else's actions are named one by one; its conditions under the step itself. */
export function itemPicks(
  body: Pick<ItemRuleBody, 'trigger' | 'conditions' | 'steps'>,
): AutomationTemplatePickAt<ItemPick>[] {
  const out: AutomationTemplatePickAt<ItemPick>[] = [];
  const add = (path: string, part: unknown): void => {
    out.push(...empties(part).map((pick) => ({ path, pick })));
  };
  add('trigger', body.trigger);
  body.conditions.forEach((c, i) => add(`conditions.${i}`, c));
  body.steps.forEach((step, i) => {
    if (step.kind !== 'if') {
      add(`steps.${i}`, step);
      return;
    }
    const branch = step as unknown as ItemIf;
    add(`steps.${i}`, branch.conditions);
    branch.then.forEach((a, j) => add(`steps.${i}.then.${j}`, a));
    branch.else.forEach((a, j) => add(`steps.${i}.else.${j}`, a));
  });
  return out;
}

/** The picks still to make in `body`: a picked one, or one whose step was deleted, drops out. */
export const itemPicksLeft = (
  body: ItemRuleBody,
  picks: readonly AutomationTemplatePickAt<ItemPick>[],
): AutomationTemplatePickAt<ItemPick>[] =>
  picksLeft(body, picks, (part, pick) => empties(part).includes(pick), itemStepLists);
