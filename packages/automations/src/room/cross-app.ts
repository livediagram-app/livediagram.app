// A step in another app, as a rule runs it (liveworkspace/docs/specs/018-automations/automations.md "Steps in other
// apps"; blueprint cross-app.md "Running"): its texts filled, the chain and the rule's day checked here, then one push
// to the index, which checks the author, signs their grant and asks the target's app. The answer is the step's line:
// Done in the target's words, a lost access that pauses the rule, a loop or a cap that skips the step, or a failure.
// Never throws. Every app's room runs its steps in other apps through this, the item engine's and liveplanner's.

import {
  CROSS_APP_RULE_DAY_MAX,
  ruleKeyOf,
  type App,
  type AutomationStepAnswer,
  type AutomationStepPush,
  type CrossAppChain,
  type CrossAppStep,
} from '@liveworkspace/index-client';
import { cutText } from '@liveworkspace/model-core/text-cut';
import { chainStop } from '../cross-app/chain';
import {
  CROSS_APP_EMPTY,
  CROSS_APP_NO_AUTHOR,
  CROSS_APP_NOT_SET_UP,
  CROSS_APP_RULE_CAPPED,
  CROSS_APP_UNREACHED,
  refusalWords,
} from '../cross-app/words';
import { ruleRunsToday } from './automation-log';
import type { Sql } from './sql';

// What a step in another app answered, as the engine takes it. `pause`: the author lost access, and the rule stops
// now; `skip`: a loop or a cap held the step back, and the run ends Skipped once the rest is done.
export type CrossAppOutcome =
  { ok: true; text: string } | { ok: false; text: string; pause?: true; skip?: true };

// The index, as a room pushes a step to it (the app's index client: kitCrossApp).
export interface CrossAppClient {
  push(itemId: string, push: AutomationStepPush): Promise<AutomationStepAnswer>;
}

export interface CrossAppRun {
  client: CrossAppClient | null;
  sql: Sql;
  app: App;
  itemId: string;
  rule: { id: string; name: string };
  // The rule's author (the person who last saved it), or null when it has none.
  author: string | null;
  from: { title: string; url: string };
  chain: CrossAppChain;
  // The run's id and the step's place: the push's key.
  key: string;
  now: number;
}

const filled = (text: string, fill: (text: string) => string, max: number) =>
  cutText(fill(text).trim(), max);

/** The step with every text filled in, cut to its bound; null when a text it needs came out empty. */
export function fillCrossAppStep(
  step: CrossAppStep,
  fill: (text: string) => string,
): CrossAppStep | null {
  switch (step.kind) {
    case 'plan_card': {
      const title = filled(step.title, fill, 200);
      if (!title) return null;
      const { assignee: written, ...rest } = step;
      const assignee = written === undefined ? '' : filled(written, fill, 80);
      return {
        ...rest,
        title,
        description: filled(step.description, fill, 2000),
        ...(assignee ? { assignee } : {}),
      };
    }
    case 'kb_page': {
      const title = filled(step.title, fill, 200);
      const body = filled(step.body, fill, 20_000);
      return title && body ? { ...step, title, body } : null;
    }
    case 'space_post': {
      const text = filled(step.text, fill, 2000);
      return text ? { ...step, text } : null;
    }
    case 'doc_tab': {
      const name = filled(step.name, fill, 200);
      return name ? { ...step, name } : null;
    }
    case 'inbox_notice': {
      const text = filled(step.text, fill, 2000);
      const to = step.to
        .map((r) => ('person' in r ? r : { value: filled(r.value, fill, 80) }))
        .filter((r) => 'person' in r || r.value !== '');
      return text && to.length ? { ...step, to, text } : null;
    }
  }
}

/** One step in another app, run: the line it leaves. `step`'s texts are filled already (fillCrossAppStep). */
export async function runCrossAppStep(
  run: CrossAppRun,
  step: CrossAppStep | null,
): Promise<CrossAppOutcome> {
  if (!run.client) return { ok: false, text: CROSS_APP_NOT_SET_UP };
  if (!step) return { ok: false, text: CROSS_APP_EMPTY };
  if (!run.author) return { ok: false, text: CROSS_APP_NO_AUTHOR, pause: true };
  const target = step.kind === 'inbox_notice' ? null : step.target;
  const stop = chainStop(run.chain, ruleKeyOf(run.app, run.itemId, run.rule.id));
  if (stop) return { ok: false, text: refusalWords(stop, '', target), skip: true };
  // This run's own pending row is among them: past the cap, this is the 101st.
  if (ruleRunsToday(run.sql, run.rule.id, run.now) > CROSS_APP_RULE_DAY_MAX)
    return { ok: false, text: CROSS_APP_RULE_CAPPED, skip: true };
  let answer: AutomationStepAnswer;
  try {
    answer = await run.client.push(run.itemId, {
      key: run.key,
      author: run.author,
      rule: run.rule,
      from: run.from,
      chain: run.chain,
      step,
    });
  } catch (error) {
    console.warn('[automations] cross.failed', { kind: step.kind, error: String(error) });
    return { ok: false, text: CROSS_APP_UNREACHED };
  }
  console.info('[automations] cross', { kind: step.kind, ok: answer.ok });
  if (answer.ok) return { ok: true, text: answer.text };
  const text = refusalWords(answer.code, answer.reason, target);
  if (answer.code === 'no_access' || answer.code === 'target_gone')
    return { ok: false, text, pause: true };
  if (answer.code === 'loop' || answer.code === 'chain_long' || answer.code === 'capped')
    return { ok: false, text, skip: true };
  return { ok: false, text };
}

/** The index as the room pushes to it: the app's own index client, or null where the deployment has no index. */
export const kitCrossApp = (
  client: {
    pushAutomationStep(itemId: string, push: AutomationStepPush): Promise<AutomationStepAnswer>;
  } | null,
): CrossAppClient | null =>
  client ? { push: (itemId, push) => client.pushAutomationStep(itemId, push) } : null;
