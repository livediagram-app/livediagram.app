// The model's answer, read (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): the text with
// its citation markers, the passages cited, the passages found but not used with the reason, and the parts of the
// question the passages do not cover. The model's reply is untrusted too: only numbers of passages that were sent
// become citations, and a reply that ignores the form is read as an answer with no citations rather than refused.
// Citations are numbered 1 to n in the order they are first cited (owner, 2026-11-21), whatever number a passage was
// sent under: the stream's pieces and the finished answer share one numbering (`CitationOrder`).
import type { AskPassage } from './ask-passages';

const ANSWER_OPEN = '<answer>';
const ANSWER_CLOSE = '</answer>';
/** A gap is logged as a question (sql/questions.ts): no more than this many from one answer, each this long. */
export const ASK_MAX_GAPS = 5;
export const ASK_MAX_GAP_CHARS = 300;
const MAX_REASON_CHARS = 300;

/** `number` is what the answer shows (1 first, in the order first cited); `sent` the AskPassage's number. */
export type AskCitation = { number: number; sent: number; passageId: string };

export type AskAnswer = {
  /** The answer, with `[n]` after each claim; `n` is the citation's shown number. */
  text: string;
  /** The passages the answer cites, in the order first cited: numbered 1 to n. */
  cited: AskCitation[];
  /** "Found but Not Used": passages set aside, and why, numbered on after the cited ones so none shares one. */
  notUsed: (AskCitation & { reason: string })[];
  /** "Knowledge Gap": the parts of the question the passages do not cover, each as a question. */
  gaps: string[];
};

const oneLine = (text: string, max: number): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, max);

/** A passage's sent number to the number shown, given as each is first cited. */
export type CitationOrder = Map<number, number>;

// A marker: `[2]`, or a list of numbers in one pair of brackets (`[1, 3]`), with the spaces before it.
const MARKER = /([ \t]*)\[(\d{1,3}(?:\s*,\s*\d{1,3}){0,11})\]/g;
// What could still become a marker at the end of a streamed piece, the spaces before it included (a marker that
// cites nothing goes with them).
const PARTIAL_MARKER = /[ \t]*(?:\[[\d,\s]{0,40})?$/;

/** `text` with each marker renumbered as first cited. A number that was not sent cites nothing and goes, and a
 *  marker left with none goes with the spaces before it. */
function renumbered(text: string, sent: ReadonlySet<number>, order: CitationOrder): string {
  return text.replace(MARKER, (_marker, lead: string, digits: string) => {
    const shown: number[] = [];
    for (const each of digits.split(',')) {
      const number = Number(each.trim());
      if (!sent.has(number)) continue;
      if (!order.has(number)) order.set(number, order.size + 1);
      const at = order.get(number)!;
      if (!shown.includes(at)) shown.push(at);
    }
    return shown.length ? `${lead}[${shown.join(', ')}]` : '';
  });
}

/** Reads a finished reply. `passages` are the ones the question was sent with; `order` the numbering the stream
 *  already gave (none: numbered here). */
export function parseAskAnswer(
  reply: string,
  passages: readonly AskPassage[],
  order: CitationOrder = new Map(),
): AskAnswer {
  const idOf = new Map(passages.map((p) => [p.number, p.passage.id]));
  const sent = new Set(idOf.keys());
  const notUsed: AskAnswer['notUsed'] = [];
  const gaps: string[] = [];
  let rest = reply.replace(
    /<not_used\s+passage="(\d{1,3})"\s*>([^<]*)<\/not_used>/g,
    (_all, digits: string, reason: string) => {
      const number = Number(digits);
      const passageId = idOf.get(number);
      const why = oneLine(reason, MAX_REASON_CHARS);
      // A passage is set aside only with its reason (it is stale and disagrees with a newer one); a bare mark, which
      // a small model sends for any passage it skipped, is no set-aside, and showing it Stale would wrong the page.
      if (passageId && why && !notUsed.some((n) => n.sent === number)) {
        notUsed.push({ number, sent: number, passageId, reason: why });
      }
      return '';
    },
  );
  rest = rest.replace(/<gap>([^<]*)<\/gap>/g, (_all, gap: string) => {
    const question = oneLine(gap, ASK_MAX_GAP_CHARS);
    if (question && gaps.length < ASK_MAX_GAPS && !gaps.includes(question)) gaps.push(question);
    return '';
  });
  const text = renumbered(
    rest.replace(ANSWER_OPEN, '').replace(ANSWER_CLOSE, ''),
    sent,
    order,
  ).trim();
  // Only what the finished answer cites: a number the stream gave is kept, never one the text no longer holds.
  const inText = new Set<number>();
  for (const match of text.matchAll(MARKER))
    for (const each of match[2]!.split(',')) inText.add(Number(each.trim()));
  const cited: AskCitation[] = [...order]
    .filter(([, number]) => inText.has(number))
    .sort((a, b) => a[1] - b[1])
    .map(([from, number]) => ({ number, sent: from, passageId: idOf.get(from)! }));
  let next = order.size;
  for (const aside of notUsed) aside.number = ++next;
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
  const sent = new Set(passages.map((p) => p.number));
  const order: CitationOrder = new Map();
  let reply = '';
  let pending = '';
  let state: 'before' | 'inside' | 'after' = 'before';
  let started = false;
  // The end of the last piece that could still be a marker, held until the next piece says.
  let tail = '';
  // The answer opens without the space the form puts after its tag, however the pieces fall; each marker is
  // renumbered as it completes.
  const show = (text: string, final = false): string => {
    let ready = tail + text;
    tail = '';
    if (!final) {
      const partial = PARTIAL_MARKER.exec(ready)!;
      if (partial[0]) {
        tail = ready.slice(partial.index);
        ready = ready.slice(0, partial.index);
      }
    }
    const numbered = renumbered(ready, sent, order);
    const shown = started ? numbered : numbered.trimStart();
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
        return show(shown, true);
      }
      const held = partialTagAt(pending, ANSWER_CLOSE);
      const shown = pending.slice(0, pending.length - held);
      pending = pending.slice(pending.length - held);
      return show(shown);
    },
    finish: (): AskAnswer => parseAskAnswer(reply, passages, order),
  };
}
