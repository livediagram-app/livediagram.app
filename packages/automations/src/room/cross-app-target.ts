// A rule's step in another app, at its target (liveworkspace/docs/specs/018-automations/automations.md "Steps in
// other apps"; blueprint cross-app.md "The door"). The index has checked the chain, the author's day and their access,
// and the app's internal door their grant; the app's room runs the step here. The step is read again (the index
// passes it whole), run inside the step's window so every event it queues carries the chain and none is an edit, and
// answered in the words of the source rule's line. What each kind writes is the app's: it hands in a run per kind
// it takes.

import {
  CROSS_APP_HOPS_MAX,
  type AutomationStepAnswer,
  type AutomationStepDoorCall,
  type CrossAppTargetedStep,
  type DocTabStep,
} from '@liveworkspace/index-client';
import { CROSS_APP_READERS } from '../cross-app/kinds';
import type { AutomationPerson } from '../types';
import { Refused, type Obj } from '../validate-read';
import { asCrossAppStep, SOMEONE } from './app/host';
import { TEMPLATE_GONE } from './app/kit-add-tab';
import type { ItemHost } from './app/host';

type Kinds = CrossAppTargetedStep['kind'];
type StepOf<K extends Kinds> = Extract<CrossAppTargetedStep, { kind: K }>;

/** The kinds an app takes as a target, each its write. */
export type CrossAppTargetRuns = {
  [K in Kinds]?: (step: StepOf<K>) => Promise<AutomationStepAnswer>;
};

export const CROSS_APP_NOT_HERE = "This app doesn't take that step";

const failed = (reason: string): AutomationStepAnswer => ({ ok: false, code: 'failed', reason });

/** The step read again as its own kind's reader reads it, or why not. */
export function readTargetStep(step: unknown): CrossAppTargetedStep | string {
  const kind = (step as { kind?: unknown } | null)?.kind;
  const read =
    typeof kind === 'string' && kind !== 'inbox_notice' ? CROSS_APP_READERS[kind] : undefined;
  if (!read) return CROSS_APP_NOT_HERE;
  try {
    return read(step as Obj, 'step', { empty: false }) as CrossAppTargetedStep;
  } catch (err) {
    if (err instanceof Refused) return err.refusal.message;
    throw err;
  }
}

/** Run the door's call with the app's runs, as `author` (their name and colour as the app knows them). */
export async function takeCrossAppStep(
  host: Pick<ItemHost, 'AUTOMATIONS'>,
  call: AutomationStepDoorCall,
  runs: CrossAppTargetRuns,
  author: AutomationPerson = { ...SOMEONE, id: call.author },
): Promise<AutomationStepAnswer> {
  if (call.chain.hops > CROSS_APP_HOPS_MAX) return { ok: false, code: 'chain_long', reason: '' };
  const step = readTargetStep(call.step);
  if (typeof step === 'string') return { ok: false, code: 'invalid', reason: step };
  const run = runs[step.kind] as
    ((s: CrossAppTargetedStep) => Promise<AutomationStepAnswer>) | undefined;
  if (!run) return { ok: false, code: 'invalid', reason: CROSS_APP_NOT_HERE };
  const answer = await asCrossAppStep(host, { author, chain: call.chain }, () => run(step));
  console.info('[automations] step from another app', { kind: step.kind, ok: answer.ok });
  return answer;
}

/** Add a Tab to a Document, over the app's own Add a Tab from a Template (kit-add-tab.ts). */
export async function takeDocTab(
  step: DocTabStep,
  addTab: (
    template: string,
    name: string,
  ) => Promise<{ id: string; name: string } | { failed: string }>,
  tabUrl: (tabId: string) => Promise<string | null> | string | null,
): Promise<AutomationStepAnswer> {
  const made = await addTab(step.docTemplate, step.name);
  if ('failed' in made)
    return made.failed === TEMPLATE_GONE
      ? { ok: false, code: 'target_gone', reason: TEMPLATE_GONE }
      : failed(made.failed);
  const link = await tabUrl(made.id);
  return {
    ok: true,
    text: `Added a tab “${made.name}” to “${step.target.title || 'Untitled'}”`,
    ...(link ? { link } : {}),
  };
}
