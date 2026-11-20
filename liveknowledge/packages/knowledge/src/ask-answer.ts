// The model's answer, read (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): the text with
// its citation markers, the passages cited, the passages found but not used with the reason, and the parts of the
// question the passages do not cover. The model's reply is untrusted too: only numbers of passages that were sent
// become citations, and a reply that ignores the form is read as an answer with no citations rather than refused.
import type { AskPassage } from './ask-passages';

const ANSWER_OPEN = '<answer>';
const ANSWER_CLOSE = '</answer>';
/** A gap is logged as a question (sql/questions.ts): no more than this many from one answer, each this long. */
export const ASK_MAX_GAPS = 5;
export const ASK_MAX_GAP_CHARS = 300;
const MAX_REASON_CHARS = 300;

export type AskCitation = { number: number; passageId: string };

export type AskAnswer = {
  /** The answer, with `[n]` after each claim; `n` is an AskPassage's number. */
  text: string;
  /** The passages the answer cites, in the order first cited. */
  cited: AskCitation[];
  /** "Found but Not Used": passages set aside, and why. */
  notUsed: (AskCitation & { reason: string })[];
  /** "Knowledge Gap": the parts of the question the passages do not cover, each as a question. */
  gaps: string[];
};

const oneLine = (text: string, max: number): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, max);

/** Reads a finished reply. `passages` are the ones the question was sent with. */
export function parseAskAnswer(reply: string, passages: readonly AskPassage[]): AskAnswer {
  const idOf = new Map(passages.map((p) => [p.number, p.passage.id]));
  const notUsed: AskAnswer['notUsed'] = [];
  const gaps: string[] = [];
  let rest = reply.replace(
    /<not_used\s+passage="(\d{1,3})"\s*>([^<]*)<\/not_used>/g,
    (_all, digits: string, reason: string) => {
      const number = Number(digits);
      const passageId = idOf.get(number);
      if (passageId && !notUsed.some((n) => n.number === number)) {
        notUsed.push({ number, passageId, reason: oneLine(reason, MAX_REASON_CHARS) });
      }
      return '';
    },
  );
  rest = rest.replace(/<gap>([^<]*)<\/gap>/g, (_all, gap: string) => {
    const question = oneLine(gap, ASK_MAX_GAP_CHARS);
    if (question && gaps.length < ASK_MAX_GAPS && !gaps.includes(question)) gaps.push(question);
    return '';
  });
  const cited: AskCitation[] = [];
  const text = rest
    .replace(ANSWER_OPEN, '')
    .replace(ANSWER_CLOSE, '')
    // A marker for a passage that was not sent cites nothing, and goes.
    .replace(/[ \t]*\[(\d{1,3})\]/g, (marker, digits: string) => {
      const number = Number(digits);
      const passageId = idOf.get(number);
      if (!passageId) return '';
      if (!cited.some((c) => c.number === number)) cited.push({ number, passageId });
      return marker;
    })
    .trim();
  return { text, cited, notUsed, gaps };
}

// How much of the end of `text` could be the start of `tag`, still to arrive.
function partialTagAt(text: string, tag: string): number {
  const from = text.lastIndexOf('<', text.length - 1);
  if (from < 0 || text.length - from >= tag.length) return 0;
  return tag.startsWith(text.slice(from)) ? text.length - from : 0;
}

/** Reads a reply as it streams: `push` takes each piece of text and answers the answer's text that became
 *  showable with it (what is inside `<answer>`, never the form's own tags or what follows the answer), and
 *  `finish` reads the whole reply. */
export function askAnswerStream(passages: readonly AskPassage[]) {
  let reply = '';
  let pending = '';
  let state: 'before' | 'inside' | 'after' = 'before';
  let started = false;
  // The answer opens without the space the form puts after its tag, however the pieces fall.
  const show = (text: string): string => {
    const shown = started ? text : text.trimStart();
    if (shown) started = true;
    return shown;
  };
  return {
    push(piece: string): string {
      reply += piece;
      if (state === 'after') return '';
      pending += piece;
      if (state === 'before') {
        const lead = pending.trimStart();
        if (lead.length < ANSWER_OPEN.length && ANSWER_OPEN.startsWith(lead)) return '';
        // A reply that does not open with the form's tag is shown as it comes.
        pending = lead.startsWith(ANSWER_OPEN) ? lead.slice(ANSWER_OPEN.length) : lead;
        state = 'inside';
      }
      const close = pending.indexOf(ANSWER_CLOSE);
      if (close >= 0) {
        const shown = pending.slice(0, close);
        pending = '';
        state = 'after';
        return show(shown);
      }
      const held = partialTagAt(pending, ANSWER_CLOSE);
      const shown = pending.slice(0, pending.length - held);
      pending = pending.slice(pending.length - held);
      return show(shown);
    },
    finish: (): AskAnswer => parseAskAnswer(reply, passages),
  };
}
