// Summarise with AI, as a rule runs it (liveworkspace/docs/specs/018-automations/automations.md "AI"; blueprint
// item-engine.md "A wake"): one bounded ask of the app's own binding over the item's text (or one tab's), counted
// against the item's day before its answer comes. Past the day's cap the step is skipped; with no binding, a model
// that errs or an answer that does not read, it fails with why.
import { AI_EMPTY, AI_NOT_SET_UP, AI_UNREADABLE, aiCappedWords } from '../../ai';
import { RUN_TAB, readSummary, summariseRequest, type ItemSummarise } from '../../item';
import { AUTOMATION_AI_PER_DAY } from '../../limits';
import type { AutomationActionLine } from '../../types';
import { aiToday, ask } from '../automation-ai';
import { markAiAsked } from '../automation-log';
import type { ItemDeps } from './kit';

export const AI_NO_TEXT = 'There is no text to summarise';
export const AI_SUMMARISED = 'Summarised with AI';

// The day's AI count as one wake or request holds it, read again only when another ask was made meanwhile.
export type AiCount = { ai?: number; aiAsks?: number };

export type Summarised = {
  line: AutomationActionLine;
  summary?: string;
  // The day's cap held the step back.
  capped?: string;
};

const fail = (text: string, asked = false): Summarised => ({
  line: { kind: 'action', ok: false, text, ...(asked ? { ai: true as const } : {}) },
});

/** One Summarise step. `asked`: the AI asks this run made before it; `tab`: the run's own tab. */
export async function runSummarise(
  deps: ItemDeps,
  state: AiCount,
  step: ItemSummarise,
  run: { id: string; asked: number; tab: string | undefined; now: number },
): Promise<Summarised> {
  const { kit, store } = deps;
  const sql = deps.sql();
  const client = kit.ai.client;
  if (!client) return fail(AI_NOT_SET_UP);
  const text = await kit.text(step.tab === RUN_TAB ? run.tab : step.tab);
  if (!text.trim()) return fail(AI_NO_TEXT);
  // Read after the text (an await), and counted with no await between: asks at once never pass the day.
  if (state.ai === undefined || state.aiAsks !== store.aiAsks) state.ai = aiToday(sql, run.now);
  if (state.ai >= AUTOMATION_AI_PER_DAY) {
    const capped = aiCappedWords(kit.itemWord);
    return { line: { kind: 'action', ok: false, text: capped }, capped };
  }
  markAiAsked(sql, run.id, run.asked + 1, run.now);
  store.aiAsks += 1;
  state.ai += 1;
  state.aiAsks = store.aiAsks;
  const asked = await ask(client, summariseRequest(text), kit.ai.gateway);
  if (!asked.ok) return fail(asked.reason, true);
  const summary = readSummary(asked.raw, text);
  if (summary === null) return fail(AI_UNREADABLE, true);
  if (summary === '') return fail(AI_EMPTY, true);
  return { line: { kind: 'action', ok: true, text: AI_SUMMARISED, ai: true }, summary };
}
