// Automations: what an app's Templates gallery is built from (liveworkspace/docs/specs/018-automations/automations.md
// "What each app adds": Templates). A template builds a rule body over the item it opens in, filling what the item
// has and leaving empty what it lacks or leaves to the person; each empty slot is a pick, named by the path the
// builder and the api use (`trigger`, `conditions.0`, `steps.1`, `steps.0.then.0`). The ids, categories, kinds of
// pick and the rule's kinds are each app's. Pure.

import type { AutomationKind, AutomationRuleBody } from './types';

// One slot a person fills before the rule can be saved.
export interface AutomationTemplatePickAt<Pick extends string = string> {
  path: string;
  pick: Pick;
}

export interface AutomationTemplateFill<
  Body extends AutomationRuleBody = AutomationRuleBody,
  Pick extends string = string,
> {
  body: Body;
  picks: AutomationTemplatePickAt<Pick>[];
}

// `Item`: what a template reads of the item it opens in (its names, and the time zone the rule is saved in).
export interface AutomationTemplate<
  Id extends string = string,
  Category extends string = string,
  Item = unknown,
  Body extends AutomationRuleBody = AutomationRuleBody,
  Pick extends string = string,
> {
  // Telemetry carries the id.
  id: Id;
  name: string;
  // The tile's sentence.
  description: string;
  category: Category;
  build: (item: Item) => AutomationTemplateFill<Body, Pick>;
}

// The lists a step holds that a path may walk into: `list` of `step`, or undefined when the step has none by that
// name.
export type TemplateStepLists<Step> = (step: Step, list: string) => readonly unknown[] | undefined;

/** The part of `body` a path names: its trigger, a condition, a step, or (through `lists`) an action inside one. */
export function partAt<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
>(
  body: AutomationRuleBody<Trigger, Condition, Step>,
  path: string,
  lists: TemplateStepLists<Step> = () => undefined,
): unknown {
  const [head, a, b, c] = path.split('.');
  if (head === 'trigger') return body.trigger;
  if (head === 'conditions') return body.conditions[Number(a)];
  const step = body.steps[Number(a)];
  if (b === undefined || !step) return step;
  return lists(step, b)?.[Number(c)];
}

/** The picks whose slot is still empty in `body` (a picked one, or a step deleted, drops out). `stillEmpty`: the
 *  app's reading of a part against a kind of pick. */
export function picksLeft<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
  Pick extends string,
>(
  body: AutomationRuleBody<Trigger, Condition, Step>,
  picks: readonly AutomationTemplatePickAt<Pick>[],
  stillEmpty: (part: unknown, pick: Pick) => boolean,
  lists?: TemplateStepLists<Step>,
): AutomationTemplatePickAt<Pick>[] {
  return picks.filter((p) => {
    const part = partAt(body, p.path, lists);
    return part !== undefined && stillEmpty(part, p.pick);
  });
}
