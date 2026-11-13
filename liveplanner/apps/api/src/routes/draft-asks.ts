// The asks of one AI draft (Describe a Plan, docs/specs/026-plan/describe-a-plan.md; Describe a Form,
// docs/specs/030-forms/describe-a-form.md): the first, and one more with the check's words when the reply doesn't
// read, never the model's own earlier text. Shared by plan-drafts.ts and form-drafts.ts, so both read a reply alike.
import { readAiReply, type AiRequest } from '@liveplanner/items';
import { ask, type AutomationsAi } from '../plan-room/automations/automation-ai';

// The asks one draft may make: the first, and one more with the check's words.
export const DRAFT_ASKS_MAX = 2;

type Refused = { path: string; message: string };
type Read = { off: true } | { draft: unknown } | { refused: Refused };

export type DraftAsked<D> =
  | { answer: 'drafted'; asks: number; out: D }
  | { answer: 'off_topic'; asks: number }
  | { answer: 'failed'; asks: number }
  | { answer: 'unreadable'; asks: number; refused: Refused | undefined };

/** Asks for a draft until one reads or the asks are spent. `onAsk` runs before each ask (its telemetry). */
export async function askForDraft<O extends Read>(input: {
  client: AutomationsAi;
  gateway: string | undefined;
  request: (previous?: Refused) => AiRequest;
  read: (reply: Record<string, unknown>) => O;
  onAsk?: () => void;
}): Promise<DraftAsked<Extract<O, { draft: unknown }>>> {
  let previous: Refused | undefined;
  let asks = 0;
  for (let n = 0; n < DRAFT_ASKS_MAX; n++) {
    asks += 1;
    input.onAsk?.();
    const asked = await ask(input.client, input.request(previous), input.gateway);
    if (!asked.ok) return { answer: 'failed', asks };
    const reply = readAiReply(asked.raw);
    if (!reply) {
      previous = { path: 'reply', message: 'the reply must be one JSON object' };
      continue;
    }
    const out = input.read(reply);
    if ('off' in out) return { answer: 'off_topic', asks };
    if ('draft' in out)
      return { answer: 'drafted', asks, out: out as Extract<O, { draft: unknown }> };
    previous = out.refused;
  }
  return { answer: 'unreadable', asks, refused: previous };
}
