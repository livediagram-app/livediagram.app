// Send to Plan's reading of the words (liveworkspace/docs/specs/004-index/send-to-plan.md "From the words"): a card's
// title, the person a mention names and the day the words give, read left to right by a tokenizer, one pass, no
// regular expression with repeats (so no input can make it backtrack). Pure.

/** The longest title the card is offered; longer words are cut at a word. */
export const SEND_TITLE_MAX = 120;

// Words past this are never read: a card's words are a sticky's or a paragraph's, and the platform keeps 2000.
const READ_MAX = 4000;

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

type Token = { text: string; start: number; end: number };

export type SendWords = {
  // The card's offered title: the first line, mention and date words out, at most SEND_TITLE_MAX.
  title: string;
  // The first `@Name`, without its `@`, or null.
  mention: string | null;
  // The first day written, as `YYYY-MM-DD`, or null.
  due: string | null;
};

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ';
// What ends a word: a space, or punctuation a date or a name never holds.
const isBreak = (c: string) =>
  isSpace(c) || c === ',' || c === ';' || c === '!' || c === '?' || c === '(' || c === ')';

function tokens(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && isBreak(line[i]!)) i += 1;
    const start = i;
    while (i < line.length && !isBreak(line[i]!)) i += 1;
    if (i > start) {
      // A full stop closing a sentence is not the word's ("by Friday.").
      let end = i;
      while (end > start + 1 && (line[end - 1] === '.' || line[end - 1] === ':')) end -= 1;
      out.push({ text: line.slice(start, end), start, end });
    }
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function isDigits(s: string): boolean {
  if (s.length === 0) return false;
  for (const c of s) if (c < '0' || c > '9') return false;
  return true;
}

// A day of the month: "1", "01", "1st", "22nd", "3rd", "4th".
function monthDay(s: string): number | null {
  let digits = s;
  const lower = s.toLowerCase();
  for (const suffix of ['st', 'nd', 'rd', 'th'])
    if (lower.endsWith(suffix)) digits = s.slice(0, -2);
  if (!isDigits(digits) || digits.length > 2) return null;
  const n = Number(digits);
  return n >= 1 && n <= 31 ? n : null;
}

const monthOf = (s: string): number | null => {
  const lower = s.toLowerCase();
  if (lower.length < 3) return null;
  const i = MONTHS.findIndex((m) => lower.startsWith(m));
  return i >= 0 && lower.length <= 9 ? i : null;
};

const weekdayOf = (s: string): number | null => {
  const lower = s.toLowerCase();
  if (lower.length < 3) return null;
  const i = WEEKDAYS.findIndex((w) => lower.startsWith(w));
  return i >= 0 && lower.length <= 9 ? i : null;
};

function realDay(year: number, month: number, day: number): string | null {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? dayOf(d) : null;
}

// `YYYY-MM-DD`, checked as a real day.
function isoDay(s: string): string | null {
  if (s.length !== 10 || s[4] !== '-' || s[7] !== '-') return null;
  const [y, m, d] = [s.slice(0, 4), s.slice(5, 7), s.slice(8, 10)];
  if (!isDigits(y) || !isDigits(m) || !isDigits(d)) return null;
  return realDay(Number(y), Number(m) - 1, Number(d));
}

type DateHit = { due: string; from: number; to: number };

// The words that make the date after them a due date ("by Friday", "due 1 Dec").
const LEADS = ['by', 'due', 'on', 'before'];

// The date a run of tokens starting at `i` writes: its day and its last token, or null.
function dateAt(
  list: readonly Token[],
  i: number,
  today: Date,
): { due: string; to: number } | null {
  const word = list[i]!.text;
  const lower = word.toLowerCase();
  const iso = isoDay(word);
  if (iso) return { due: iso, to: i };
  if (lower === 'today') return { due: dayOf(today), to: i };
  if (lower === 'tomorrow') {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return { due: dayOf(t), to: i };
  }
  const next = list[i + 1]?.text;
  const day = monthDay(word);
  const monthAfter = next !== undefined ? monthOf(next) : null;
  if (day !== null && monthAfter !== null) {
    const due = realDay(today.getFullYear(), monthAfter, day);
    if (due) return { due, to: i + 1 };
  }
  const month = monthOf(word);
  const dayAfter = next !== undefined ? monthDay(next) : null;
  if (month !== null && dayAfter !== null) {
    const due = realDay(today.getFullYear(), month, dayAfter);
    if (due) return { due, to: i + 1 };
  }
  // A weekday: the next one, a week on when it is today.
  const weekday = weekdayOf(word);
  if (weekday !== null) {
    const ahead = (weekday - today.getDay() + 7) % 7 || 7;
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
    return { due: dayOf(t), to: i };
  }
  return null;
}

// The first due date among the tokens: its day and the tokens it spans (to take out of the title). A date is a due
// date only right after a lead word (which is taken out with it) or standing alone at the line's very end; anywhere
// else it is prose ("Every return today starts…") and stays.
function firstDate(list: readonly Token[], today: Date): DateHit | null {
  for (let i = 0; i < list.length; i += 1) {
    const hit = dateAt(list, i, today);
    if (!hit) continue;
    const led = i > 0 && LEADS.includes(list[i - 1]!.text.toLowerCase());
    if (led) return { due: hit.due, from: i - 1, to: hit.to };
    if (hit.to === list.length - 1) return { due: hit.due, from: i, to: hit.to };
  }
  return null;
}

// A mention's name: what follows `@`, up to its first character a name never holds.
function mentionName(word: string): string | null {
  if (word.length < 2 || word[0] !== '@') return null;
  let end = 1;
  while (end < word.length && word[end] !== '@' && word[end] !== '.' && word[end] !== ':') end += 1;
  const name = word.slice(1, end);
  return name.length > 0 ? name : null;
}

// Cut at a word, never mid-word, to `max`.
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max + 1);
  const space = room.lastIndexOf(' ');
  return (space > max / 2 ? room.slice(0, space) : text.slice(0, max)).trim();
}

/** The words read as a card: title, mention and day. `today` is the person's own local day. */
export function readSendWords(raw: string, today: Date): SendWords {
  const text = raw.length > READ_MAX ? raw.slice(0, READ_MAX) : raw;
  let mention: string | null = null;
  let due: string | null = null;
  let title = '';
  let titleDone = false;
  let lineStart = 0;
  while (lineStart <= text.length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd < 0) lineEnd = text.length;
    const line = text.slice(lineStart, lineEnd);
    lineStart = lineEnd + 1;
    const list = tokens(line);
    if (list.length === 0) {
      if (lineEnd === text.length) break;
      continue;
    }
    const skip = new Set<number>();
    for (let i = 0; i < list.length; i += 1) {
      const name = mentionName(list[i]!.text);
      if (name === null) continue;
      if (mention === null) mention = name;
      if (!titleDone) skip.add(i);
    }
    const hit: DateHit | null = due === null ? firstDate(list, today) : null;
    if (hit) {
      due = hit.due;
      if (!titleDone) for (let i = hit.from; i <= hit.to; i += 1) skip.add(i);
    }
    if (!titleDone) {
      title = list
        .filter((_, i) => !skip.has(i))
        .map((t) => t.text)
        .join(' ')
        .trim();
      titleDone = title.length > 0;
    }
    if (titleDone && mention !== null && due !== null) break;
    if (lineEnd === text.length) break;
  }
  return { title: cutAtWord(title, SEND_TITLE_MAX), mention, due };
}

/** The plan person a mention names, by whole name or first name, ignoring case; null when nobody is. */
export function matchPerson(mention: string, people: readonly { name: string }[]): string | null {
  const want = mention.trim().toLowerCase();
  if (!want) return null;
  const whole = people.find((p) => p.name.trim().toLowerCase() === want);
  if (whole) return whole.name;
  const first = people.find((p) => p.name.trim().toLowerCase().split(' ')[0] === want);
  return first ? first.name : null;
}

// The words between two dates that make them a span ("1 Dec to 12 Dec", "2026-12-01 - 2026-12-12").
const SPAN_WORDS = ['-', '\u2013', '\u2014', 'to', 'until', 'till', 'through', 'thru', '→'];

/** The words as a span of work: its title with both dates out, and its first and last day; null without a span. */
export function readSendSpan(
  raw: string,
  today: Date,
): { title: string; start: string; due: string } | null {
  const text = raw.length > READ_MAX ? raw.slice(0, READ_MAX) : raw;
  const nl = text.indexOf('\n');
  const line = nl < 0 ? text : text.slice(0, nl);
  const list = tokens(line);
  for (let i = 0; i < list.length; i += 1) {
    const first = dateAt(list, i, today);
    if (!first) continue;
    const sep = list[first.to + 1]?.text.toLowerCase();
    if (sep === undefined || !SPAN_WORDS.includes(sep)) continue;
    const second = first.to + 2 < list.length ? dateAt(list, first.to + 2, today) : null;
    if (!second) continue;
    const start = first.due;
    let due = second.due;
    // A span written across the new year ("20 Dec to 5 Jan") ends in the next one.
    if (due < start) {
      const [y, m, d] = due.split('-').map(Number) as [number, number, number];
      due = realDay(y + 1, m - 1, d) ?? start;
    }
    // A lead word before the span ("from 1 Dec to 5 Dec") goes with it.
    const lead = i > 0 && ['from', 'on', 'between'].includes(list[i - 1]!.text.toLowerCase());
    const from = lead ? i - 1 : i;
    const title = list
      .filter((_, k) => k < from || k > second.to)
      .map((t) => t.text)
      .join(' ')
      .trim();
    return { title: cutAtWord(title, SEND_TITLE_MAX), start, due };
  }
  return null;
}

/** The day the words write when they are nothing but a date ("1 Dec", "2026-12-01", "Dec 8"), else null. */
export function readWholeDate(raw: string, today: Date): string | null {
  const text = raw.trim();
  if (!text || text.length > 40 || text.includes('\n')) return null;
  const list = tokens(text);
  if (list.length === 0 || list.length > 3) return null;
  const lower = list[0]!.text.toLowerCase();
  // Weekdays and "today" name no place on an axis.
  if (lower === 'today' || lower === 'tomorrow' || weekdayOf(list[0]!.text) !== null) return null;
  const hit = dateAt(list, 0, today);
  return hit && hit.to === list.length - 1 ? hit.due : null;
}
