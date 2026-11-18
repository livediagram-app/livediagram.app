// The Forum's check (liveworkspace/docs/specs/007-community/community.md "The Forum", "The check"): every topic, reply
// and edit is read by Workers AI's content safety model before anyone else sees it. It passes (listed), fails
// (refused), or can't answer (pending, asked again by the cron). Nothing is listed unchecked: only a `pass` lists.

import {
  FORUM_CHECK_MODEL,
  FORUM_CHECK_TIMEOUT_MS,
  FORUM_CHECKS_PER_DAY,
  FORUM_RETRY_BATCH,
  FORUM_REPORTS_KEEP_MS,
  FORUM_RETRY_EVERY_MS,
} from '../config';
import { forumCheckSkippedLocally, type Env } from '../env';
import { countAgainst, DAY_MS, pruneForumCounters } from './rate';
import { pendingDue, pruneForumReports, settleCheck, type ForumRow, type Verdict } from './store';
import { neuronsOf, recordCheck, withinNeuronBudget, type CheckOutcome } from './tally';

/** The model's answer as a verdict: `{ response: { safe } }`, `{ safe }`, or text starting `safe` or `unsafe`.
 *  Anything else is not an answer. */
export function readVerdict(raw: unknown): Verdict {
  const outer = raw as { response?: unknown } | null;
  const response = outer && typeof outer === 'object' && 'response' in outer ? outer.response : raw;
  if (response && typeof response === 'object') {
    const safe = (response as { safe?: unknown }).safe;
    if (typeof safe === 'boolean') return safe ? 'pass' : 'refuse';
    return 'unavailable';
  }
  if (typeof response === 'string') {
    const text = response.trim().toLowerCase();
    if (text.startsWith('unsafe')) return 'refuse';
    if (text.startsWith('safe')) return 'pass';
  }
  return 'unavailable';
}

/** What the check reads: everything the post shows, the author's name included. */
export function checkedText(name: string, title: string, body: string): string {
  return [`Name: ${name}`, title ? `Title: ${title}` : '', body].filter(Boolean).join('\n\n');
}

const SLOW = Symbol('slow');

const OUTCOME: Record<Verdict, CheckOutcome> = {
  pass: 'listed',
  refuse: 'refused',
  unavailable: 'waiting',
};

// The tally is for the dashboard: a failure to write it never changes a check's answer.
async function tally(env: Env, verdict: Verdict, neurons: number, now: number): Promise<void> {
  try {
    await recordCheck(env, OUTCOME[verdict], neurons, now);
  } catch (error) {
    console.warn('[forum] tally failed', { error: String(error) });
  }
}

/** One check: the day's caps first (checks, then Neurons), then the model, bounded by the timeout. Its outcome and the
 *  Neurons it used are tallied. Never throws. */
export async function checkForumText(env: Env, text: string, now: number): Promise<Verdict> {
  if (forumCheckSkippedLocally(env)) return 'pass';
  const ai = env.AI;
  if (!ai) return 'unavailable';
  if (!(await countAgainst(env, 'checks', DAY_MS, FORUM_CHECKS_PER_DAY, now))) {
    console.warn('[forum] check failed', { reason: 'daily_cap' });
    await tally(env, 'unavailable', 0, now);
    return 'unavailable';
  }
  if (!(await withinNeuronBudget(env, now).catch(() => true))) {
    console.warn('[forum] check failed', { reason: 'neuron_cap' });
    await tally(env, 'unavailable', 0, now);
    return 'unavailable';
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<typeof SLOW>((resolve) => {
    timer = setTimeout(() => resolve(SLOW), FORUM_CHECK_TIMEOUT_MS);
  });
  try {
    const raw = await Promise.race([
      ai.run(FORUM_CHECK_MODEL, { messages: [{ role: 'user', content: text }] }),
      slow,
    ]);
    if (raw === SLOW) {
      console.warn('[forum] check failed', { reason: 'slow' });
      await tally(env, 'unavailable', 0, now);
      return 'unavailable';
    }
    const verdict = readVerdict(raw);
    if (verdict === 'unavailable') console.warn('[forum] check failed', { reason: 'unreadable' });
    await tally(env, verdict, neuronsOf(raw, text), now);
    return verdict;
  } catch (error) {
    console.warn('[forum] check failed', { reason: 'error', error: String(error) });
    await tally(env, 'unavailable', 0, now);
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}

const textOf = (row: ForumRow) => checkedText(row.author_name, row.title, row.body);

/** The cron's part: the posts waiting longest asked again, together, each settled; then old counters dropped. */
export async function retryForumChecks(env: Env, now: number = Date.now()): Promise<void> {
  if (env.AI || forumCheckSkippedLocally(env)) {
    const due = await pendingDue(env, now - FORUM_RETRY_EVERY_MS, FORUM_RETRY_BATCH);
    if (due.length > 0) {
      const verdicts = await Promise.all(due.map((row) => checkForumText(env, textOf(row), now)));
      await Promise.all(due.map((row, i) => settleCheck(env, row, verdicts[i]!, now)));
      const tally = (v: Verdict) => verdicts.filter((x) => x === v).length;
      console.info('[forum] settled', {
        listed: tally('pass'),
        refused: tally('refuse'),
        waiting: tally('unavailable'),
      });
    }
  }
  await pruneForumCounters(env, now);
  // Reports are pruned once an hour: the first run of each hour (the cron's five minutes make it exactly one).
  if (new Date(now).getUTCMinutes() < 5) await pruneForumReports(env, now - FORUM_REPORTS_KEEP_MS);
}
