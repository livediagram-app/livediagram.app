// Every value of an import is untrusted text (docs/specs/026-plan/tracker-import.md "Reading the file"): read as the
// characters it is, never as markup, cleaned of control characters and cut to its field's limit. Dates, priorities and
// estimates are read from the forms the four tools write.
import { cardDateOf } from '../board-csv';
import type { Priority } from '../fields';
import { isEmailAddress } from '../item-types';
import { ITEM_NUMBER_MAX } from '../limits';
import { statusKey } from '../status-names';
import type { TrackerPerson } from './tracker-model';

const ELLIPSIS = '…';

// Whether a character code is one the text keeps: anything printable, a tab and a line break.
const kept = (c: number) => c === 9 || c === 10 || (c >= 32 && c !== 127 && (c < 128 || c > 159));

function withoutControls(s: string): string {
  let clean = true;
  for (let i = 0; i < s.length; i += 1) {
    if (!kept(s.charCodeAt(i))) {
      clean = false;
      break;
    }
  }
  if (clean) return s;
  let out = '';
  for (let i = 0; i < s.length; i += 1) if (kept(s.charCodeAt(i))) out += s[i];
  return out;
}

// `text` cut to `max` characters, the last an ellipsis when it was cut.
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}${ELLIPSIS}`;
}

// A value as clean text: a string (a number as its text, anything else empty), line breaks as \n, control
// characters but tabs and line breaks dropped, trimmed and cut to `max`.
export function cleanText(raw: unknown, max: number): string {
  const s =
    typeof raw === 'string' ? raw : typeof raw === 'number' && Number.isFinite(raw) ? `${raw}` : '';
  if (!s) return '';
  return cutText(withoutControls(s.replace(/\r\n?/g, '\n')).trim(), max);
}

// A link only when it is an http or https address; anything else (javascript:, data:, a file path) is no link.
export function httpLink(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Jira's export date: `31/Oct/26`, `31/Oct/2026`, either with a time (`3:45 PM`, `15:45`).
const JIRA_DATE =
  /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?)?$/;

function jiraParts(text: string): { y: number; m: number; d: number; ms: number } | undefined {
  const m = JIRA_DATE.exec(text);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return undefined;
  const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let hours = m[4] ? Number(m[4]) : 0;
  const pm = m[6]?.toLowerCase() === 'pm';
  if (m[6]) hours = (hours % 12) + (pm ? 12 : 0);
  const minutes = m[5] ? Number(m[5]) : 0;
  return { y, m: month + 1, d: Number(m[1]), ms: (hours * 60 + minutes) * 60_000 };
}

// A card's day (YYYY-MM-DD) from what the tools write: ISO 8601 (a date or an instant), the day-first dates Import
// CSV reads, and Jira's `31/Oct/26`; undefined for anything else or a day that does not exist.
export function trackerDay(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  const day = cardDateOf(text);
  if (day) return day;
  const jira = jiraParts(text);
  return jira ? cardDateOf(`${jira.y}-${jira.m}-${jira.d}`) : undefined;
}

// A moment (unix ms, UTC) from an ISO 8601 instant or date, or a Jira date and time; null when none.
export function trackerInstant(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const at = Date.parse(text);
    return Number.isFinite(at) ? at : null;
  }
  const jira = jiraParts(text);
  if (!jira || !trackerDay(text)) return null;
  return Date.UTC(jira.y, jira.m - 1, jira.d) + jira.ms;
}

const PRIORITY_WORDS: Readonly<Record<string, Priority>> = {
  urgent: 'urgent',
  highest: 'urgent',
  critical: 'urgent',
  blocker: 'urgent',
  high: 'high',
  medium: 'medium',
  normal: 'medium',
  low: 'low',
  lowest: 'low',
  minor: 'low',
  trivial: 'low',
};

// A priority from the words the tools use (Jira's Highest is Urgent, Lowest is Low); undefined for "No priority"
// and anything else.
export function trackerPriority(raw: unknown): Priority | undefined {
  if (typeof raw !== 'string') return undefined;
  return PRIORITY_WORDS[statusKey(raw)];
}

// An estimate: a number from 0 to 999 (a story point count), else undefined.
export function trackerEstimate(raw: unknown): number | undefined {
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= ITEM_NUMBER_MAX ? n : undefined;
}

// The line an imported comment starts with: its author and the day it was written ("Ana Lopez · 12 Mar 2025").
export function commentHeader(author: string, at: number | null): string {
  const who = author || 'Unknown';
  if (at === null) return who;
  const d = new Date(at);
  return `${who} · ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// The longest name a person keeps (CUSTOM_ASSIGNEE_NAME_MAX).
const PERSON_NAME_MAX = 60;

// A person from a cell: an email address is kept (lower-cased) and named by its local part, unless a name is given.
export function trackerPersonOf(rawName: unknown, rawEmail?: unknown): TrackerPerson | undefined {
  const name = cleanText(rawName, 320);
  const email = cleanText(rawEmail, 320).toLowerCase();
  const nameIsEmail = isEmailAddress(name);
  const address = isEmailAddress(email) ? email : nameIsEmail ? name.toLowerCase() : undefined;
  const shown = nameIsEmail || !name ? (address?.split('@')[0] ?? '') : name;
  const cut = cutText(shown, PERSON_NAME_MAX);
  if (!cut) return undefined;
  return address ? { name: cut, email: address } : { name: cut };
}
