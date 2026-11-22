// How easily an article reads (docs/specs/007-editor/article-pages.md "Word Count"): its reading time, its sentences
// and their length, and its Flesch Reading Ease said in words. Shared by the editor's Word Count line and agents'
// article summaries, so both say the same. Text is read by one left-to-right pass, each character looked at once,
// never a regex over the writing (a pasted run of dots or spaces can't make it slow). English first: the formula is
// English's, so another language gets the reading time and sentence figures without a level. Pure.
import type { ArticleBlock, ArticleFlow } from './article-flow';

// An adult's silent reading pace for non-fiction, words a minute (Brysbaert 2019, a meta-analysis of 190 studies).
export const READING_WORDS_PER_MINUTE = 238;
// A sentence of more words than this is long: plain language guides put the line between 25 and 35.
export const LONG_SENTENCE_WORDS = 30;
// The writing reads as English when at least this share of its words are among ENGLISH_MARKERS (English prose runs
// near 30%; another language's, a few % at most).
export const ENGLISH_SHARE = 0.15;
// The language is judged on the first this-many words: plenty to tell, and a long article costs no more.
export const ENGLISH_SAMPLE = 2000;

// The commonest English words that other languages written in Latin letters don't use as words of their own
// ("a", "in", "is", "was", "on" and "an" are left out: Spanish, German, Dutch and French have them too).
const ENGLISH_MARKERS = new Set([
  'the',
  'and',
  'of',
  'to',
  'that',
  'it',
  'for',
  'you',
  'with',
  'are',
  'this',
  'have',
  'be',
  'not',
  'they',
  'we',
  'he',
  'his',
  'by',
  'from',
  'at',
  'but',
  'what',
  'which',
  'would',
  'can',
  'there',
  'their',
  'were',
  'has',
  'been',
  'if',
  'more',
  'when',
  'all',
  'your',
  'our',
  'these',
  'how',
  'should',
  'could',
]);

// The longest marker with the quotes and stops round it.
const MARKER_MAX = 10;

// A full stop after one of these ends no sentence (lower case, the stop left off): the ones a capital or a number
// often follows ("Dr. Smith", "Fig. 3"). One a lower-case word follows carries on anyway ("etc. and").
const ABBREVIATIONS = new Set([
  'dr',
  'mr',
  'mrs',
  'ms',
  'mx',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'cf',
  'approx',
  'fig',
  'figs',
  'vol',
  'pp',
  'ca',
  'dept',
  'eg',
  'ie',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
]);

export type Sentence = {
  // Where it starts and ends in the text (end exclusive, after its last token).
  start: number;
  end: number;
  words: number;
  syllables: number;
};

export type ReadingLevel = 'easy' | 'fairlyEasy' | 'plain' | 'fairlyHard' | 'hard';

export type Readability = {
  // Minutes to read the words, at least 1; 0 for none.
  readingMinutes: number;
  sentences: number;
  // The prose's words a sentence, one decimal; 0 with no sentence.
  wordsPerSentence: number;
  // Sentences over LONG_SENTENCE_WORDS.
  longSentences: number;
  // Flesch Reading Ease, one decimal; null when the prose isn't English or has no sentence.
  ease: number | null;
  level: ReadingLevel | null;
};

const isSpace = (c: number) =>
  c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 11 || c === 0xa0 || c === 0x2028;
// Closing quotes and brackets that may follow a sentence's end: " ' ) ] ” ’ » and *.
const CLOSERS = new Set(['"', "'", ')', ']', '”', '’', '»', '*', '_']);
// A letter: ASCII by its code, anything else by whether it has a case (accented and other cased scripts).
const isLetter = (ch: string) => {
  const c = ch.charCodeAt(0);
  if (c < 128) return (c | 32) >= 97 && (c | 32) <= 122;
  return ch.toLowerCase() !== ch.toUpperCase();
};
const isDigit = (ch: string) => ch >= '0' && ch <= '9';
// a e i o u y, lower case.
const isVowelCode = (c: number) =>
  c === 97 || c === 101 || c === 105 || c === 111 || c === 117 || c === 121;

// What the token just scanned holds (module scratch, so the pass allocates nothing per token): whether it is a word
// (a letter or digit in it), its syllables, and whether its first letter or digit is a lower-case letter.
let tokenIsWord = false;
let tokenSyllables = 0;
let tokenStartsLower = false;

// One look at each character of text[start, end): the three facts above. Syllables by the usual estimate: the
// groups of vowels, one fewer for a silent final "e" (not "-le" after a consonant), at least one; no letter, one.
function scanToken(text: string, start: number, end: number): void {
  let groups = 0;
  let inVowel = false;
  let letters = 0;
  // The last three letters, lower case (l1 the last).
  let l1 = 0;
  let l2 = 0;
  let l3 = 0;
  let first = true;
  tokenIsWord = false;
  tokenStartsLower = false;
  for (let j = start; j < end; j++) {
    const c = text.charCodeAt(j);
    let lc: number;
    if (c < 128) {
      if (c >= 48 && c <= 57) {
        first = false;
        tokenIsWord = true;
        inVowel = false;
        continue;
      }
      lc = c | 32;
      if (lc < 97 || lc > 122) {
        inVowel = false;
        continue;
      }
      if (first) tokenStartsLower = c === lc;
    } else {
      const ch = text[j]!;
      const lower = ch.toLowerCase();
      if (lower === ch.toUpperCase()) {
        inVowel = false;
        continue;
      }
      if (first) tokenStartsLower = ch === lower;
      lc = lower.charCodeAt(0);
    }
    first = false;
    tokenIsWord = true;
    letters++;
    const v = isVowelCode(lc);
    if (v && !inVowel) groups++;
    inVowel = v;
    l3 = l2;
    l2 = l1;
    l1 = lc;
  }
  if (letters === 0) {
    tokenSyllables = 1;
    return;
  }
  // A silent final e: "make", not "table" (-le after a consonant) nor "agree".
  if (
    groups > 1 &&
    l1 === 101 &&
    !isVowelCode(l2) &&
    !(l2 === 108 && letters > 2 && !isVowelCode(l3))
  )
    groups--;
  tokenSyllables = Math.max(1, groups);
}

/** A word's syllables, by the usual estimate: its groups of vowels, one fewer for a silent final "e" (not "-le"
 *  after a consonant), at least one. A token with no letter (a number) is one. */
export function syllablesOf(word: string): number {
  scanToken(word, 0, word.length);
  return tokenSyllables;
}

// Only letters and stops ("e.g", "U.S"), looked at without copying.
function dottedLetters(body: string): boolean {
  for (let k = 0; k < body.length; k++) if (body[k] !== '.' && !isLetter(body[k]!)) return false;
  return true;
}

// How text[start, end) ends a sentence: 'yes' (! ? …), 'stop' (a full stop, decided by the next token), or 'no'.
function endingOf(text: string, start: number, end: number): 'yes' | 'stop' | 'no' {
  let i = end - 1;
  while (i >= start && CLOSERS.has(text[i]!)) i--;
  if (i < start) return 'no';
  const last = text[i]!;
  if (
    last === '!' ||
    last === '?' ||
    last === '…' ||
    last === '。' ||
    last === '！' ||
    last === '？'
  )
    return 'yes';
  if (last !== '.') return 'no';
  // A run of stops ("...") ends one.
  if (i > start && text[i - 1] === '.') return 'yes';
  // The word before the stop, its opening quotes and brackets left off.
  let from = start;
  while (from < i && !isLetter(text[from]!) && !isDigit(text[from]!)) from++;
  const body = text.slice(from, i);
  if (body.length === 0) return 'stop';
  // An initial ("J.") or a dotted abbreviation ("e.g.", "U.S.") ends none.
  if (body.length === 1 && isLetter(body)) return 'no';
  if (body.includes('.') && dottedLetters(body)) return 'no';
  if (ABBREVIATIONS.has(body.toLowerCase())) return 'no';
  return 'stop';
}

/** A block of text's sentences, in one left-to-right pass: the text's end always ends one. Tokens are runs of
 *  non-space; a token holding a letter or digit is a word, handed to `onWord` as its place in the text. */
export function sentencesOf(
  text: string,
  onWord?: (text: string, start: number, end: number) => void,
): Sentence[] {
  const out: Sentence[] = [];
  let current: Sentence | null = null;
  // A sentence ended by a full stop waits here for the next token, which decides it.
  let pending = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (isSpace(text.charCodeAt(i))) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && !isSpace(text.charCodeAt(i))) i++;
    scanToken(text, start, i);
    if (pending && current) {
      // A word in lower case after the stop carries the sentence on ("etc. and"); else it ended.
      if (!tokenStartsLower) {
        out.push(current);
        current = null;
      }
      pending = false;
    }
    if (!current) current = { start, end: i, words: 0, syllables: 0 };
    current.end = i;
    if (tokenIsWord) {
      current.words++;
      current.syllables += tokenSyllables;
      onWord?.(text, start, i);
    }
    const ending = endingOf(text, start, i);
    if (ending === 'yes') {
      out.push(current);
      current = null;
    } else if (ending === 'stop') pending = true;
  }
  if (current) out.push(current);
  return out.filter((s) => s.words > 0);
}

/** Flesch Reading Ease: 206.835 − 1.015 × words a sentence − 84.6 × syllables a word, to one decimal. */
export function fleschReadingEase(words: number, sentences: number, syllables: number): number {
  const ease = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(ease * 10) / 10;
}

/** The level a Flesch Reading Ease says, in Flesch's own bands. */
export function readingLevelOf(ease: number): ReadingLevel {
  if (ease >= 80) return 'easy';
  if (ease >= 70) return 'fairlyEasy';
  if (ease >= 60) return 'plain';
  if (ease >= 50) return 'fairlyHard';
  return 'hard';
}

export const READING_LEVEL_LABEL: Readonly<Record<ReadingLevel, string>> = {
  easy: 'Easy to read',
  fairlyEasy: 'Fairly easy to read',
  plain: 'Plain English',
  fairlyHard: 'Fairly hard to read',
  hard: 'Hard to read',
};

/** Minutes to read a number of words, at least 1; 0 for none. */
export function readingMinutesFor(words: number): number {
  return words <= 0 ? 0 : Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

// A prose block's text: paragraphs (headings, quotes and the title among them) and list items; a footnote's
// reference is a space, its note no sentence.
function proseOf(b: ArticleBlock): string | null {
  if (b.type !== 'paragraph' && b.type !== 'list') return null;
  let text = '';
  for (const r of b.runs) text += r.fn === undefined ? r.text : ' ';
  return text;
}

/** How easily a run of prose texts reads (each text ends a sentence), `words` being the count the reading time is
 *  said from (the article's Word Count). */
export function readabilityOfTexts(texts: Iterable<string>, words: number): Readability {
  let sentences = 0;
  let proseWords = 0;
  let syllables = 0;
  let long = 0;
  let english = 0;
  // The words the language is judged on: the first ENGLISH_SAMPLE. Only a short token can be a marker, so the
  // rest are never sliced.
  let sampled = 0;
  const onWord = (text: string, start: number, end: number) => {
    if (sampled >= ENGLISH_SAMPLE) return;
    sampled++;
    if (end - start > MARKER_MAX) return;
    let from = start;
    let to = end;
    while (from < to && !isLetter(text[from]!)) from++;
    while (to > from && !isLetter(text[to - 1]!)) to--;
    if (ENGLISH_MARKERS.has(text.slice(from, to).toLowerCase())) english++;
  };
  for (const text of texts) {
    for (const s of sentencesOf(text, onWord)) {
      sentences++;
      proseWords += s.words;
      syllables += s.syllables;
      if (s.words > LONG_SENTENCE_WORDS) long++;
    }
  }
  const ease =
    sentences > 0 && english / sampled >= ENGLISH_SHARE
      ? fleschReadingEase(proseWords, sentences, syllables)
      : null;
  return {
    readingMinutes: readingMinutesFor(words),
    sentences,
    wordsPerSentence: sentences > 0 ? Math.round((proseWords / sentences) * 10) / 10 : 0,
    longSentences: long,
    ease,
    level: ease === null ? null : readingLevelOf(ease),
  };
}

/** How easily an article's writing reads, as answered: `words` its Word Count. */
export function articleReadability(flow: ArticleFlow, words: number): Readability {
  const texts: string[] = [];
  for (const b of flow.blocks) {
    const t = proseOf(b);
    if (t !== null) texts.push(t);
  }
  return readabilityOfTexts(texts, words);
}

/** "4 min read", or null for no words. */
export function readingTimeLabel(r: Pick<Readability, 'readingMinutes'>): string | null {
  return r.readingMinutes > 0 ? `${r.readingMinutes} min read` : null;
}

/** The numbers behind the level, for a hover: "14 words a sentence on average · 3 sentences over 30 words · Flesch
 *  Reading Ease 72". */
export function readabilityDetail(r: Readability): string {
  if (r.sentences === 0) return 'No sentences yet';
  const avg = Number.isInteger(r.wordsPerSentence)
    ? String(r.wordsPerSentence)
    : r.wordsPerSentence.toFixed(1);
  const parts = [
    `${avg} ${r.wordsPerSentence === 1 ? 'word' : 'words'} a sentence on average`,
    r.longSentences === 0
      ? `none over ${LONG_SENTENCE_WORDS} words`
      : `${r.longSentences} ${r.longSentences === 1 ? 'sentence' : 'sentences'} over ${LONG_SENTENCE_WORDS} words`,
  ];
  if (r.ease !== null) parts.push(`Flesch Reading Ease ${Math.round(r.ease)}`);
  return parts.join(' · ');
}
