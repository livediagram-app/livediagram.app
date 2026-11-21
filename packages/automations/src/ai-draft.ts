// Describe a Rule's pure parts every app shares (liveworkspace/docs/specs/018-automations/automations.md "AI"): the
// request (the app's fixed instructions in the system message, the person's words and the app's description of the
// item as one JSON object of data in the user message), and the reply read into a rule body held to everything a
// person's rule is: chain off, the saver's time zone, every text cut and cleaned of links the person didn't write,
// then the app's own check. The most a reply can do is put an unsaved, off rule in front of the person who asked.
// What the model is told of the item, and how names in its reply go back to ids, are each app's. Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import { dropForeignLinks, type AiRequest } from './ai';
import { AUTOMATION_ACTIONS_MAX, AUTOMATION_NAME_MAX } from './limits';
import type { AutomationTemplatePickAt } from './templates';
import type { AutomationKind, AutomationRuleBody } from './types';
import { freeRuleName } from './validate';
import { isObj, type Obj, type RuleRefusal } from './validate-read';

// Limits (spec "Runs, limits and loops", "AI").
export const AI_DRAFT_PROMPT_MAX = 500;
export const AI_DRAFT_PER_DAY = 20;
export const AI_DRAFT_MAX_TOKENS = 1500;
// A name the model is sent of the item.
export const AI_DRAFT_NAME_MAX = 40;
// The most of a reply's rule the reader walks: past these a list is cut before the check counts it.
export const AI_DRAFT_STEPS_READ_MAX = AUTOMATION_ACTIONS_MAX + 5;

// The words a draft's refusals say (the dialog's are the editor's; these are the api's `message`). `item`: what the
// app calls it ("space", "design").
export const aiDraftOffTopicWords = (item: string): string =>
  `That doesn't read as a rule for this ${item}. Say when it should run and what it should do, like the examples.`;
export const AI_DRAFT_UNREADABLE =
  "Couldn't draft a rule from that. Try saying it another way, or start from a template.";
// A failed ask (slow, down or refused) in the dialog's words: the step outcomes' own wording stays the Audit Trail's.
export const AI_DRAFT_FAILED = "The AI couldn't answer just now. Try again in a moment.";
export const aiDraftCappedWords = (item: string): string =>
  `This ${item} has drafted ${AI_DRAFT_PER_DAY} rules today. Try again tomorrow, or build the rule yourself.`;

// ---- What the model is sent ------------------------------------------------------------------------------------------

/** A name as the model is sent it: control characters gone, trimmed, cut to its cap. */
export const aiDraftName = (s: string): string =>
  cutText(s.replace(/\p{Cc}/gu, ' ').trim(), AI_DRAFT_NAME_MAX);

// The reply's shape: a rule (its name, trigger, conditions and steps), or not one.
export const AI_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['rule', 'not_a_rule'] },
    rule: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: AUTOMATION_NAME_MAX },
        trigger: { type: 'object' },
        conditions: { type: 'array', items: { type: 'object' } },
        steps: { type: 'array', items: { type: 'object' }, maxItems: AUTOMATION_ACTIONS_MAX },
      },
      required: ['name', 'trigger', 'conditions', 'steps'],
    },
  },
  required: ['outcome'],
  additionalProperties: false,
};

/** The ask: the app's fixed instructions, then the request and `about` (the app's description of the item, under
 *  the key its instructions name) as one JSON object, and, on the second ask, the check's words for what the first
 *  rule got wrong, never the model's own earlier text. */
export function aiDraftRequest(
  system: string,
  prompt: string,
  about: Readonly<Record<string, unknown>>,
  previous?: { path: string; message: string },
): AiRequest {
  const data = {
    request: cutText(prompt, AI_DRAFT_PROMPT_MAX),
    ...about,
    ...(previous
      ? { previous: { refused: cutText(`${previous.path}: ${previous.message}`, 300) } }
      : {}),
  };
  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(data) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'automation_draft', schema: AI_DRAFT_SCHEMA, strict: true },
    },
    max_tokens: AI_DRAFT_MAX_TOKENS,
    temperature: 0,
  };
}

// ---- The reply -------------------------------------------------------------------------------------------------------

export interface AiDraftContext {
  // The person's own words: the only place a draft's links may come from.
  prompt: string;
  // The saver's IANA time zone.
  timeZone: string;
  // The item's rules, so the draft's name is free.
  rules: readonly { id: string; name: string }[];
}

// What an app hands the reader: how names in the reply go back to ids (absent, the rule is read as written), how
// each step's texts are cleaned in place, and its own check of the rule.
export interface AiDraftKit<Body extends AutomationRuleBody> {
  named?: (rule: Obj) => unknown;
  cleanStep?: (step: Obj, own: string) => void;
  read: (v: unknown) => { body: Body } | RuleRefusal;
}

export type AiDraftOutcome<Body extends AutomationRuleBody = AutomationRuleBody> =
  | { off: true }
  | { body: Body; picks: AutomationTemplatePickAt<'webhook'>[] }
  | { refused: { path: string; message: string } };

// A connection placeholder the check reads as an id; a draft's message steps go back to '' (a pick) after it.
const WEBHOOK_HOLE = 'draft-webhook';

/** A drafted text: control characters gone (a line break kept where the text may hold lines), every link the
 *  person's words lack removed, cut to `max`. Anything but a string is left for the check to refuse. */
export function draftText(v: unknown, own: string, max: number, lines = false): unknown {
  if (typeof v !== 'string') return v;
  const plain = cutText(v, max * 2).replace(lines ? /[^\P{Cc}\n]/gu : /\p{Cc}/gu, ' ');
  const linked = dropForeignLinks(plain, own)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cutText(linked, max);
}

/** The reply read: not a rule; a rule that reads, unsaved and off, with what is left to pick; or why it doesn't
 *  read (for the second ask). Only the rule's name, trigger, conditions and steps are read: anything else the reply
 *  holds (on, chain, a time zone, keys of its own) is dropped. */
export function readAiDraft<Body extends AutomationRuleBody>(
  reply: Obj,
  ctx: AiDraftContext,
  kit: AiDraftKit<Body>,
): AiDraftOutcome<Body> {
  if (reply['outcome'] === 'not_a_rule') return { off: true };
  const raw = reply['rule'];
  if (reply['outcome'] !== 'rule' || !isObj(raw))
    return {
      refused: { path: 'outcome', message: 'reply with outcome rule and a rule, or not_a_rule' },
    };
  const steps = Array.isArray(raw['steps'])
    ? raw['steps'].slice(0, AI_DRAFT_STEPS_READ_MAX)
    : raw['steps'];
  const picks: AutomationTemplatePickAt<'webhook'>[] = [];
  const own = ctx.prompt;
  const written: Obj = {
    name: draftText(raw['name'], own, AUTOMATION_NAME_MAX),
    trigger: raw['trigger'],
    conditions: raw['conditions'] ?? [],
    steps,
  };
  const named = (kit.named ? kit.named(written) : written) as Obj;
  if (Array.isArray(named['steps']))
    named['steps'].forEach((s: unknown, i: number) => {
      if (!isObj(s)) return;
      kit.cleanStep?.(s, own);
      if (s['kind'] === 'notify') {
        s['webhook'] = WEBHOOK_HOLE;
        delete s['name'];
        picks.push({ path: `steps.${i}`, pick: 'webhook' });
      }
    });
  if (named['name'] === '') named['name'] = 'New Rule';
  const read = kit.read({ ...named, chain: false, timeZone: ctx.timeZone });
  if ('error' in read) return { refused: { path: read.path, message: read.message } };
  const body = read.body;
  const out = {
    ...body,
    name: freeRuleName(body.name, ctx.rules),
    steps: body.steps.map((s: AutomationKind) => (s.kind === 'notify' ? { ...s, webhook: '' } : s)),
  } as Body;
  return { body: out, picks };
}
