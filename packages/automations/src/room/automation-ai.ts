// A rule's AI asks made and counted (liveworkspace/docs/specs/018-automations/automations.md "AI"; blueprint
// engine.md "The room entry"). Each ask is one call to Workers AI through the app's own `AI` binding (no key, no
// secret), bounded by a timeout. An item asks at most AUTOMATION_AI_PER_DAY a day, counted as each call is asked
// (`automation_ai_days`, one row a day, bumped by markAiAsked) and from Describe a Rule's asks: two indexed reads. No binding, a model that errs or takes too long: the
// ask answers its reason and never throws. What is asked and what an answer writes are each app's.
import { AI_FAILED, AI_SLOW, type AiRequest } from '../ai';
import type { Sql } from './sql';

// The part of the Workers AI binding Automations calls.
export interface AutomationsAi {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: { gateway?: { id: string } },
  ): Promise<unknown>;
}

// The model (Workers AI's catalogue, Nov 2026): a small, cheap instruct model with JSON mode, not on the deprecation
// list, its thinking mode turned off so an answer costs only its own tokens.
export const AUTOMATION_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const AUTOMATION_AI_TIMEOUT_MS = 15_000;

const DAY_MS = 24 * 60 * 60 * 1000;

// The binding the room asks through, or null where there is none (tests, local dev without Cloudflare, a fork).
export function aiClient(env: { AI?: AutomationsAi }): AutomationsAi | null {
  return env.AI ?? null;
}

const midnight = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

// The AI calls the item made today (UTC): the rules' calls, counted as each was asked (a pending run's at once), and
// Describe a Rule's asks.
export function aiToday(sql: Sql, now: number): number {
  const day = midnight(now);
  const row = sql
    .exec(
      `SELECT COALESCE((SELECT asks FROM automation_ai_days WHERE day = ?), 0)
            + (SELECT COUNT(*) FROM automation_ai_drafts WHERE at >= ?) AS n`,
      day,
      day,
    )
    .toArray()[0];
  return Number(row?.['n'] ?? 0);
}

// A rule's AI call counted against the day as it is asked; rows before yesterday go as a day's first call is counted.
export function countAiAsk(sql: Sql, now: number): void {
  const day = midnight(now);
  const first =
    sql
      .exec(
        `INSERT INTO automation_ai_days (day, asks) VALUES (?, 1)
         ON CONFLICT (day) DO UPDATE SET asks = asks + 1 RETURNING asks`,
        day,
      )
      .toArray()[0]?.['asks'] === 1;
  if (first) sql.exec('DELETE FROM automation_ai_days WHERE day < ?', day - DAY_MS);
}

// The rules Describe a Rule drafted today (UTC): each draft's first ask.
export function draftsToday(sql: Sql, now: number): number {
  const row = sql
    .exec(
      'SELECT COUNT(*) AS n FROM automation_ai_drafts WHERE at >= ? AND retry = 0',
      midnight(now),
    )
    .toArray()[0];
  return Number(row?.['n'] ?? 0);
}

// One Describe a Rule ask, counted; asks past two days go.
export function countDraftAsk(sql: Sql, now: number, retry: boolean): void {
  sql.exec('DELETE FROM automation_ai_drafts WHERE at < ?', midnight(now) - DAY_MS);
  sql.exec('INSERT INTO automation_ai_drafts (at, retry) VALUES (?, ?)', now, retry ? 1 : 0);
}

const SLOW = Symbol('slow');

export type Asked = { ok: true; raw: unknown } | { ok: false; reason: string };

// One call, bounded by the timeout; the model's own error and a gateway's refusal are the same failure to a rule.
export async function ask(
  client: AutomationsAi,
  request: AiRequest,
  gateway: string | undefined,
): Promise<Asked> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<typeof SLOW>((resolve) => {
    timer = setTimeout(() => resolve(SLOW), AUTOMATION_AI_TIMEOUT_MS);
  });
  try {
    const raw = await Promise.race([
      client.run(
        AUTOMATION_AI_MODEL,
        { ...request, chat_template_kwargs: { enable_thinking: false } },
        gateway ? { gateway: { id: gateway } } : undefined,
      ),
      slow,
    ]);
    return raw === SLOW ? { ok: false, reason: AI_SLOW } : { ok: true, raw };
  } catch (error) {
    console.warn('[automations] ai.failed', { error: String(error) });
    return { ok: false, reason: AI_FAILED };
  } finally {
    clearTimeout(timer);
  }
}
