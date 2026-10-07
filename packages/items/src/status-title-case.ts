// A status (column) name in Title Case (docs/specs/026-plan/plan-board.md "Column names"): every word capitalised,
// except a short article, conjunction or preposition in the middle ("Ready for QA", "Waiting on Review"). The first
// and last words are always capitalised ("To Do", "Waiting On"). A word that already carries a capital after its
// first letter is kept as typed (QA, MVP, iOS, McKinley), as is anything that is not a letter. Parts of a hyphenated
// word are each capitalised ("No-Go", "Follow-Up"); a letter after an apostrophe is not ("Won't Fix").

// The short words kept lower case mid-name.
const MINOR_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'nor',
  'for',
  'so',
  'yet',
  'as',
  'at',
  'by',
  'in',
  'of',
  'on',
  'per',
  'to',
  'up',
  'via',
  'vs',
]);

// A capital after the first letter means the word was cased on purpose (an acronym, a brand): keep it.
const casedOnPurpose = (word: string) => /\p{Lu}/u.test(word.slice(1));

const capitalise = (word: string) =>
  word.replace(/^(\P{L}*)(\p{L})/u, (_, lead: string, first: string) => lead + first.toUpperCase());

function caseWord(word: string, edge: boolean): string {
  if (casedOnPurpose(word)) return word;
  const lower = word.toLowerCase();
  if (!edge && MINOR_WORDS.has(lower)) return lower;
  return lower
    .split('-')
    .map((part) => capitalise(part))
    .join('-');
}

export function statusTitleCase(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.map((w, i) => caseWord(w, i === 0 || i === words.length - 1)).join(' ');
}
