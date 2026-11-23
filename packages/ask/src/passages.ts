// The passages a question is answered from (liveworkspace/docs/specs/019-ask/ask.md "What is sent"): the open item's
// own text, a passage per element, card or block that holds words. The editor makes them from the tabs it already
// holds (the ones Search reads), chooses the ones the question is about, and sends those; the server reads what it is
// sent within the same bounds. Pure, and linear in the item's text.
import {
  ASK_MAX_ID_CHARS,
  ASK_MAX_LABEL_CHARS,
  ASK_MAX_ONE_PASSAGE_CHARS,
  ASK_MAX_PASSAGES,
  ASK_MAX_PASSAGE_CHARS,
} from './limits';

/** One place in the item that holds words. */
export type AskPassage = {
  /** Unique in the item: what a citation and its source card are matched by. */
  id: string;
  /** The tab it is on, and that tab's name as people see it. */
  tabId: string;
  tabName: string;
  /** The element (or card) to go to, where there is one; null for a passage that is a whole tab's. */
  elementId: string | null;
  /** What it is, in the app's own word, Title Case ("Shape", "Sticky Note", "Card"). */
  kind: string;
  /** Its name: an element's label cut short, a card's title. */
  title: string;
  text: string;
};

/** A passage as it is sent: `number` is what the answer cites it by, 1 first. */
export type NumberedPassage = { number: number; passage: AskPassage };

// Words too common to say what a question is about.
const COMMON = new Set(
  'the and for are but not you all any can her was one our out day get has him his how its may new now old see two way who did why what when where which with from that this they them then than have will your into does about there their would could should'.split(
    ' ',
  ),
);
/** A question is ranked by at most this many words. */
export const ASK_MAX_RANK_WORDS = 24;

/** A question's content words: letters or digits, three or more, not common, each once, `max` at most. */
export function contentWords(question: string, max: number = ASK_MAX_RANK_WORDS): string[] {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words.filter((word) => !COMMON.has(word)))].slice(0, max);
}

const cut = (passage: AskPassage): AskPassage =>
  passage.text.length > ASK_MAX_ONE_PASSAGE_CHARS
    ? { ...passage, text: passage.text.slice(0, ASK_MAX_ONE_PASSAGE_CHARS) }
    : passage;

// How well a passage answers the words: a word in its title counts three, in its text or its tab's name one.
function scoreOf(passage: AskPassage, words: readonly string[]): number {
  if (words.length === 0) return 0;
  const title = passage.title.toLowerCase();
  const text = passage.text.toLowerCase();
  const tab = passage.tabName.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (title.includes(word)) score += 3;
    if (text.includes(word)) score += 1;
    if (tab.includes(word)) score += 1;
  }
  return score;
}

/**
 * The passages to send for `question`, numbered. An item whose words all fit goes whole, in its own order, so a
 * question about the item as a whole ("summarise this") is answered from all of it. A larger one sends the passages
 * the question's words are found in, best first, then the rest in the item's order, until the bounds are met.
 * `earlier` are the conversation's questions so far: a follow-up ("who owns it?") is ranked with their words too, at
 * a lower weight.
 */
export function choosePassages(
  question: string,
  all: readonly AskPassage[],
  earlier: readonly string[] = [],
): NumberedPassage[] {
  const held = all.filter((p) => p.text.trim() !== '').map(cut);
  let total = 0;
  for (const p of held) total += p.text.length;
  let ordered = held;
  if (held.length > ASK_MAX_PASSAGES || total > ASK_MAX_PASSAGE_CHARS) {
    const words = contentWords(question);
    const before = contentWords(earlier.join(' ')).filter((w) => !words.includes(w));
    ordered = held
      .map((passage, at) => ({
        passage,
        at,
        score: scoreOf(passage, words) * 2 + scoreOf(passage, before),
      }))
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .map((ranked) => ranked.passage);
  }
  const chosen: NumberedPassage[] = [];
  let left = ASK_MAX_PASSAGE_CHARS;
  for (const passage of ordered) {
    if (chosen.length === ASK_MAX_PASSAGES) break;
    // A passage that does not fit is left out, and a shorter one after it may still be taken.
    if (passage.text.length > left) continue;
    chosen.push({ number: chosen.length + 1, passage });
    left -= passage.text.length;
  }
  return chosen;
}

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';
const idOf = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' && value.length <= ASK_MAX_ID_CHARS ? value : null;

/**
 * The passages a request carries, read defensively (the server's side): an array of objects with an id, a tab and
 * some text, each field cut to its bound, at most ASK_MAX_PASSAGES and ASK_MAX_PASSAGE_CHARS, numbered as sent. A
 * passage that is not one, repeats an id, or would pass the bounds is left out.
 */
export function readPassages(value: unknown): NumberedPassage[] {
  if (!Array.isArray(value)) return [];
  const read: NumberedPassage[] = [];
  const seen = new Set<string>();
  let left = ASK_MAX_PASSAGE_CHARS;
  for (const raw of value) {
    if (read.length === ASK_MAX_PASSAGES) break;
    if (!raw || typeof raw !== 'object') continue;
    const from = raw as Record<string, unknown>;
    const id = idOf(from.id);
    const tabId = idOf(from.tabId);
    const body = text(from.text, ASK_MAX_ONE_PASSAGE_CHARS);
    if (!id || !tabId || body.trim() === '' || seen.has(id) || body.length > left) continue;
    seen.add(id);
    left -= body.length;
    read.push({
      number: read.length + 1,
      passage: {
        id,
        tabId,
        tabName: text(from.tabName, ASK_MAX_LABEL_CHARS),
        elementId: idOf(from.elementId),
        kind: text(from.kind, ASK_MAX_LABEL_CHARS),
        title: text(from.title, ASK_MAX_LABEL_CHARS),
        text: body,
      },
    });
  }
  return read;
}
