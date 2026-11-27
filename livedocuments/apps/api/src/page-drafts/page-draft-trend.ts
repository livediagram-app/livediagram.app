// Whether a request gives data over time (docs/specs/007-editor/describe-a-page.md "Every kind", "Charts and changes
// only for trends"). A layout with a chart, or one whose figures each carry a change ("+18%" against last quarter),
// keeps its sample chart and invents changes when the request has neither, so it is offered only when the request
// speaks of a trend: a change, a comparison with before, a run of periods, or a chart asked for. And whether it gives
// figures ("12k", "94%", "1.4M"), which a layout of numbered parts ("01", "02") cannot hold ("Figures not parts").
// Read word by word, never with a pattern over the whole text.

// Words that mean change over time, a comparison with before, or a chart.
const TREND_WORDS = new Set([
  'trend',
  'trends',
  'trending',
  'growth',
  'grew',
  'grow',
  'grows',
  'growing',
  'rise',
  'rises',
  'rose',
  'risen',
  'fell',
  'fall',
  'falls',
  'fallen',
  'drop',
  'dropped',
  'decline',
  'declined',
  'increase',
  'increased',
  'decrease',
  'decreased',
  'doubled',
  'tripled',
  'halved',
  'change',
  'changes',
  'changed',
  'delta',
  'deltas',
  'vs',
  'versus',
  'compared',
  'against',
  'since',
  'monthly',
  'quarterly',
  'weekly',
  'yearly',
  'annually',
  'yoy',
  'qoq',
  'chart',
  'charts',
  'graph',
  'graphs',
  'timeline',
  'history',
  'historical',
  'forecast',
]);

// "last year", "previous quarter", "over time": two words that together mean before.
const BEFORE = new Set(['last', 'previous', 'prior', 'over']);
const PERIODS = new Set([
  'year',
  'years',
  'quarter',
  'quarters',
  'month',
  'months',
  'week',
  'weeks',
  'time',
]);

const MONTHS = new Set([
  'jan',
  'january',
  'feb',
  'february',
  'mar',
  'march',
  'apr',
  'april',
  'jun',
  'june',
  'jul',
  'july',
  'aug',
  'august',
  'sep',
  'sept',
  'september',
  'oct',
  'october',
  'nov',
  'november',
  'dec',
  'december',
]);

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

/** The request's words, lowercased: letters and digits with the marks a figure keeps ("+18%", "3.2m", "q3"). */
function wordsOf(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const c of text.toLowerCase()) {
    if (/[\p{L}\p{N}+\-−.%]/u.test(c)) word += c;
    else if (word) {
      out.push(word);
      word = '';
    }
  }
  if (word) out.push(word);
  return out;
}

/** True when the request gives or asks for data over time, so a chart or a change has something to show. */
export function hasTrendData(prompt: string): boolean {
  const words = wordsOf(prompt);
  const quarters = new Set<string>();
  const months = new Set<string>();
  const years = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!.replace(/[.%]+$/, '');
    if (TREND_WORDS.has(w)) return true;
    if (BEFORE.has(w) && PERIODS.has(words[i + 1] ?? '')) return true;
    // A signed figure is a change: "+18%", "-3", "−0.4".
    if ((w[0] === '+' || w[0] === '-' || w[0] === '−') && isDigit(w[1])) return true;
    if (w.length === 2 && w[0] === 'q' && w[1]! >= '1' && w[1]! <= '4') quarters.add(w);
    if (MONTHS.has(w)) months.add(w);
    if (w.length === 4 && (w.startsWith('19') || w.startsWith('20')) && [...w].every(isDigit))
      years.add(w);
  }
  // A run of periods: figures given for two quarters, months or years.
  return quarters.size > 1 || months.size > 1 || years.size > 1;
}

// ---------- Figures, not numbered parts

// The longest a part's number is: "01", "12", "3.".
const ORDINAL_MAX = 3;

/** A part's number, as an agenda or a list of steps shows it: one digit, or two with a leading zero, maybe a full
 *  stop ("1", "01", "2."). "48" is a figure. */
export function isOrdinal(text: string): boolean {
  const t = text.trim().replace(/\.$/, '');
  return (t.length === 1 || (t.length === 2 && t[0] === '0')) && [...t].every(isDigit);
}

/** The longest words a number slot takes: a part's number slot ("01") a short ordinal, any other slot no limit. */
export const figureMaxFor = (sample: string): number | null =>
  isOrdinal(sample) ? ORDINAL_MAX : null;

const TIME_ENDS = ['am', 'pm', 'min', 'mins'];

// A part's number in a request ("4 parts", "step 2") is no figure: a small whole number.
const SMALL_COUNT = 20;

/**
 * True when the request gives figures to show: two or more numbers, at least one more than a small count ("12k",
 * "94%", "1.4M", "£2m", "48"). A time ("9:30") and a year are not figures, nor "4 parts, 10 minutes each".
 */
export function givesFigures(prompt: string): boolean {
  let numbers = 0;
  let big = false;
  for (const raw of prompt.split(/[\s,;()]+/)) {
    const w = raw.replace(/[.!?:]+$/, '');
    // A time ("9:30", "9am", "10min") is when, not how many.
    const lower = w.toLowerCase();
    if (![...w].some(isDigit) || w.includes(':') || TIME_ENDS.some((e) => lower.endsWith(e)))
      continue;
    const digits = [...w].filter(isDigit).join('');
    if (w.length === 4 && digits === w && (w.startsWith('19') || w.startsWith('20'))) continue;
    numbers += 1;
    // A unit, a decimal or a currency makes it a figure; else its size.
    if (digits !== w || Number(digits) > SMALL_COUNT) big = true;
  }
  return numbers > 1 && big;
}
