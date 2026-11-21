// Automations: the AI steps' pure parts every app shares (liveworkspace/docs/specs/018-automations/automations.md
// "AI"). The request's shape (fixed instructions in the system message, the item's data as one JSON object in the
// user message), the reply read from whatever shape the binding answers, an answer's text held to plain words with
// no link its source lacked, and the words a failed or skipped step says. The room makes the call
// (room/automation-ai.ts); what is sent and what an answer may write are each app's. Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import { AUTOMATION_AI_PER_DAY, AUTOMATION_AI_SUMMARY_MAX } from './limits';
import { isObj, type Obj } from './validate-read';

// The most the model may answer, in tokens, per shared task (a summary's 600 characters are about 150).
export const AI_MAX_TOKENS = { summarise: 300 } as const;

// The reasons a step fails or is skipped, as the Audit Trail says them.
export const AI_NOT_SET_UP = "AI isn't set up here";
export const AI_FAILED = "The AI couldn't answer: try again later";
export const AI_SLOW = 'The AI took too long to answer';
export const AI_UNREADABLE = "The AI's reply couldn't be read";
// `item`: what the app calls it ("space", "design").
export const aiCappedWords = (item: string): string =>
  `This ${item} has used its ${AUTOMATION_AI_PER_DAY} AI steps today`;
// A later AI step once one has failed: the run stopped there.
export const AI_NOT_ASKED = 'Not asked: a step before it failed';
// A step after a failed AI step: never written.
export const STEP_NOT_DONE = 'Not done: a step before it failed';
export const AI_EMPTY = "The AI's summary came out empty";

export interface AiRequest {
  messages: { role: 'system' | 'user'; content: string }[];
  response_format: {
    type: 'json_schema';
    json_schema: { name: string; schema: Obj; strict: true };
  };
  max_tokens: number;
  temperature: 0;
}

// ---- The reply -------------------------------------------------------------------------------------------------------

// The body of a text's first fenced block (```, an optional `json`, then up to the next ```), found with indexOf so a
// hostile reply (``` and a long run of whitespace, no closing fence) costs linear time, not a regex's backtracking.
export function fencedBody(text: string): string | undefined {
  const open = text.indexOf('```');
  if (open < 0) return undefined;
  let from = open + 3;
  if (text.slice(from, from + 4).toLowerCase() === 'json') from += 4;
  const close = text.indexOf('```', from);
  return close < 0 ? undefined : text.slice(from, close);
}

// The JSON object a text holds: all of it, a fenced block, or the span from its first `{` to its last `}`.
function objectIn(text: string): Obj | null {
  const fenced = fencedBody(text);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  for (const candidate of [
    text,
    fenced,
    start >= 0 && end > start ? text.slice(start, end + 1) : undefined,
  ]) {
    if (candidate === undefined) continue;
    try {
      const v: unknown = JSON.parse(candidate.trim());
      if (isObj(v)) return v;
    } catch {
      // Not this candidate; the next may be.
    }
  }
  return null;
}

/** The reply's JSON object, from any shape the binding answers: `{ response }` (an object, or text holding one),
 *  `{ choices: [{ message: { content } }] }`, or a string. Null when there is none. */
export function readAiReply(raw: unknown): Obj | null {
  let v: unknown = raw;
  if (isObj(raw)) {
    if ('response' in raw) v = raw['response'];
    else if (Array.isArray(raw['choices'])) {
      const first: unknown = raw['choices'][0];
      const message = isObj(first) ? first['message'] : undefined;
      v = isObj(message) ? message['content'] : undefined;
    }
  }
  if (typeof v === 'string') return objectIn(v);
  return isObj(v) ? v : null;
}

// ---- The answer, constrained -----------------------------------------------------------------------------------------

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;

/** A replacer for a link that keeps one `own` already holds and blanks any other: an AI's text never brings a link
 *  the person's own words lacked. A sentence's mark after a link ("see https://x.example/1.") is no part of it. */
export const keepOwnLink =
  (own: string) =>
  (link: string): string =>
    own.includes(trimSentenceMarks(link)) ? link : ' ';

const SENTENCE_MARKS = '.,;:!?';

/** `link` without the sentence marks it ends on. An index walk, linear in the link: a regex for "marks at the end"
 *  backtracks over every run of marks the link holds, quadratic on model output full of them. */
const trimSentenceMarks = (link: string): string => {
  let end = link.length;
  while (end > 0 && SENTENCE_MARKS.includes(link[end - 1]!)) end -= 1;
  return link.slice(0, end);
};

/** Every link in `text` that `own` lacks, blanked; the rest of the text as it was. */
export const dropForeignLinks = (text: string, own: string): string =>
  text.replace(LINK, keepOwnLink(own));

// The most of a reply a summary reads (a 300-token reply is about 1,200 characters).
const AI_REPLY_READ_MAX = 8_000;

/** A summary as plain text: control characters, tags and Markdown marks gone, every link `own` (the text that was
 *  summarised) didn't hold removed, whitespace collapsed, cut at a word to the summary's length. */
export function plainSummary(text: string, own: string, max = AUTOMATION_AI_SUMMARY_MAX): string {
  // A reply is at most 300 tokens; anything longer is cut before any pattern reads it.
  const plain = text
    .slice(0, AI_REPLY_READ_MAX)
    // Control characters (a tab or a line break is a space).
    .replace(/\p{Cc}/gu, ' ')
    .replace(/```[a-z]*/gi, ' ')
    .replace(/<[^<>]*>/g, ' ')
    // [words](address) reads as its words; the address stays only if `own` held it.
    .replace(/\[([^[\]]*)\]\(([^()]*)\)/g, '$1 $2')
    .replace(/\*\*|__|`|^#+\s*/gm, '')
    .replace(LINK, keepOwnLink(own))
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const head = cutText(plain, max - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}…`;
}
