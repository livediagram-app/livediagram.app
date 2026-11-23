// Describe a Rule, `POST …/automations/draft` (liveworkspace/docs/specs/018-automations/automations.md "AI"; blueprint
// item-engine.md "Routes"), behind the Automations gate. The person's words and the item's tab names go to the
// model; its reply is read into a rule body, unsaved and off, or asked once more with the check's words. Nothing is
// saved or run: the route writes only its count of asks, which share the day's AI asks and cap the drafts a day.
// Every refusal's message is fixed words, never the model's; the request and the reply are never logged.
import type {
  AutomationDraftResponse,
  AutomationError,
} from '@liveworkspace/api-schema/automations';
import { AI_NOT_SET_UP, aiCappedWords, readAiReply } from '../../ai';
import {
  AI_DRAFT_FAILED,
  AI_DRAFT_PER_DAY,
  AI_DRAFT_PROMPT_MAX,
  AI_DRAFT_UNREADABLE,
  aiDraftCappedWords,
  aiDraftOffTopicWords,
  aiDraftRequest,
} from '../../ai-draft';
import { isRuleTimeZone } from '../../dates';
import {
  itemDraftAbout,
  itemDraftSystem,
  readItemDraft,
  type ItemPick,
  type ItemRuleBody,
} from '../../item';
import { AI_KEY_FAILED, keyedRunner, ownKeyOf, type AiKeyFailure } from '@liveworkspace/ai';
import { AUTOMATION_AI_PER_DAY } from '../../limits';
import {
  AUTOMATION_KEYED_TIMEOUT_MS,
  aiToday,
  ask,
  countDraftAsk,
  draftsToday,
} from '../automation-ai';
import { ITEM_TELEMETRY_ACTION } from './telemetry';
import { json, readBody, refuse, type Gated } from './route-kit';

// The asks one draft may make: the first, and one more with the check's words.
export const ITEM_DRAFT_ASKS_MAX = 2;

const say = (status: number, error: AutomationError, message: string, path?: string) =>
  refuse(status, error, { message, ...(path ? { path } : {}) });

// A person's key the provider refused, or that will not open: said in fixed words, with whose it is, so the source
// line can say so and offer to fix it. Never any part of the key.
const keyFailed = (aiKey: AiKeyFailure, message: string) =>
  refuse(422, AI_KEY_FAILED, { message, aiKey });

export async function draftRule(g: Gated): Promise<Response> {
  const raw = await readBody(g.request);
  if (raw instanceof Response) return raw;
  const { kit, store } = g.deps;
  const prompt = typeof raw['prompt'] === 'string' ? raw['prompt'].trim() : '';
  if (!prompt || prompt.length > AI_DRAFT_PROMPT_MAX)
    return say(
      400,
      'automation_draft_invalid',
      `prompt must be 1 to ${AI_DRAFT_PROMPT_MAX} characters`,
      'prompt',
    );
  const timeZone = raw['timeZone'];
  if (!isRuleTimeZone(timeZone))
    return say(400, 'automation_draft_invalid', 'timeZone must name a time zone', 'timeZone');
  // Which AI drafts it (ai-keys.md "Every AI feature honours the choice"): the caller's key, or the item's team's,
  // else built-in AI. On a key nothing of the item's AI allowance is read or spent.
  const own = ownKeyOf(g.caller.aiKey ? await g.caller.aiKey() : null);
  if (own.status === 'refused')
    return own.reason === 'unreadable'
      ? keyFailed(own.failure, own.words)
      : say(503, 'automation_ai_unavailable', own.words);
  const keyed = own.status === 'key' ? own : null;
  const client = keyed ? keyedRunner(keyed.caller) : kit.ai.client;
  if (!client) return say(503, 'automation_ai_unavailable', AI_NOT_SET_UP);
  const sql = g.deps.sql();
  const started = Date.now();
  const capped = () => say(429, 'automation_ai_capped', aiCappedWords(kit.itemWord));
  if (!keyed) {
    if (aiToday(sql, started) >= AUTOMATION_AI_PER_DAY) return capped();
    if (draftsToday(sql, started) >= AI_DRAFT_PER_DAY)
      return say(429, 'automation_ai_capped', aiDraftCappedWords(kit.itemWord));
  }

  const outline = await kit.outline();
  const system = itemDraftSystem(kit.kinds);
  const about = itemDraftAbout(outline);
  const context = { prompt, timeZone, rules: store.list() };
  const count = (type: string) =>
    kit.defer(kit.telemetry([{ category: kit.category, action: ITEM_TELEMETRY_ACTION, type }]));
  let previous: { path: string; message: string } | undefined;
  let asks = 0;
  // The refused path (a step's place, never the request's words) says which check a draft that didn't read failed.
  const done = (answer: string, response: Response) => {
    const refused = answer === 'unreadable' ? previous?.path : undefined;
    console.info('[automations] draft', { answer, asks, tookMs: Date.now() - started, refused });
    return response;
  };
  for (let n = 0; n < ITEM_DRAFT_ASKS_MAX; n += 1) {
    // The day's AI asks read again before each ask, with no await before it is counted: a rule's ask made while
    // the item was read counts. A first ask past them is refused; a second is not made, the draft did not read.
    if (!keyed) {
      if (aiToday(sql, Date.now()) >= AUTOMATION_AI_PER_DAY) {
        if (n === 0) return capped();
        break;
      }
      countDraftAsk(sql, Date.now(), n > 0);
      store.aiAsks += 1;
    }
    asks += 1;
    count('AutomationAiDraft');
    const request = aiDraftRequest(system, prompt, about, previous);
    const asked = keyed
      ? await ask(client, request, undefined, AUTOMATION_KEYED_TIMEOUT_MS)
      : await ask(client, request, kit.ai.gateway);
    if (!asked.ok) {
      if (keyed && asked.keyFailure)
        return done(
          'key_failed',
          keyFailed({ source: keyed.source, ...asked.keyFailure }, asked.reason),
        );
      // On a key, the provider's fixed words (busy, rate limited); on built-in AI, the draft's.
      return done(
        'failed',
        say(503, 'automation_ai_unavailable', keyed ? asked.reason : AI_DRAFT_FAILED),
      );
    }
    const reply = readAiReply(asked.raw);
    if (!reply) {
      previous = { path: 'reply', message: 'the reply must be one JSON object' };
      continue;
    }
    const out = readItemDraft(reply, context, kit.kinds, outline);
    if ('off' in out) {
      count('AutomationAiOffTopic');
      return done(
        'off_topic',
        say(422, 'automation_draft_off_topic', aiDraftOffTopicWords(kit.itemWord)),
      );
    }
    if ('body' in out) {
      const answer: AutomationDraftResponse<ItemRuleBody, ItemPick> = {
        rule: out.body,
        picks: out.picks,
      };
      return done('drafted', json(answer));
    }
    previous = out.refused;
  }
  return done('unreadable', say(422, 'automation_draft_unreadable', AI_DRAFT_UNREADABLE));
}
