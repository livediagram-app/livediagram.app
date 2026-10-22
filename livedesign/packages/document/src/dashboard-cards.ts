// The Dashboard's written cards (docs/specs/026-plan/plan-tabs.md "Cards"): what someone writes on the page itself
// rather than what the document's work shows. A Status (On Track, At Risk, Off Track, a line of why, when it last
// changed), a Checklist (items ticked off), a Key Date (a date counted down to) and Links (labelled links to sites or
// this document's tabs). Pure: each is read safely from storage, within its limits, never trusted as stored.

import { PLAN_SHEET_ID_PATTERN } from './element-types';
import type { DashboardCardStyle } from './dashboard-card-style';

export const DASHBOARD_CARD_TITLE_MAX = 120;
export const DASHBOARD_CARD_TEXT_MAX = 500;
export const DASHBOARD_CHECKLIST_ITEMS_MAX = 30;
export const DASHBOARD_CHECKLIST_ITEM_MAX = 200;
export const DASHBOARD_LINKS_MAX = 12;
export const DASHBOARD_LINK_LABEL_MAX = 80;
const DASHBOARD_LINK_URL_MAX = 2000;

export const DASHBOARD_STATUSES = ['on-track', 'at-risk', 'off-track'] as const;
export type DashboardStatus = (typeof DASHBOARD_STATUSES)[number];

// A figure from a form (docs/specs/026-plan/plan-tabs.md "Form Metrics"): which Form tab, and what of it: its responses
// so far, how many are new to the reader, whether it takes responses, its responses against its limit, when it closes,
// or its link to copy. An empty tab id is one not chosen yet (the document's only form is chosen as it is placed).
export const FORM_METRICS = ['responses', 'new', 'status', 'limit', 'closes', 'link'] as const;
export type FormMetricKind = (typeof FORM_METRICS)[number];
export type FormMetricContent = { type: 'form-metric'; metric: FormMetricKind; formTabId: string };
// A tab id as stored: any short string (ids are minted by the editor and checked against the tabs when read).
const TAB_ID_MAX = 80;

export type DashboardChecklistItem = { id: string; text: string; done: boolean };
// A link to a site (`url`, http, https or mailto) or to a tab of this document (`tabId`).
export type DashboardLink = { id: string; label: string } & (
  { url: string; tabId?: undefined } | { tabId: string; url?: undefined }
);

// A figure from a Sheet (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): which sheet, and the cell (a
// figure, with an optional target cell) or column (a summary or a trend) by stable row and column ids. An empty sheet
// id is one not set up yet.
export const SHEET_METRICS = ['figure', 'summary', 'trend'] as const;
export type SheetMetricKind = (typeof SHEET_METRICS)[number];
const SHEET_METRIC_STATS = ['sum', 'average', 'min', 'max', 'count'] as const;
export type SheetMetricStat = (typeof SHEET_METRIC_STATS)[number];
export type SheetMetricCell = { r: string; c: string };
export type SheetMetricContent = {
  type: 'sheet-metric';
  metric: SheetMetricKind;
  sheetId: string;
  cell?: SheetMetricCell;
  target?: SheetMetricCell;
  col?: string;
  stat?: SheetMetricStat;
};

export type DashboardCardContent =
  // `at`: when the state or its line last changed (ms since the epoch).
  // `style`: its look (dashboard-card-style.ts), read with the slot (dashboard.ts readContent).
  | { type: 'status'; state: DashboardStatus; text: string; at: number; style?: DashboardCardStyle }
  | {
      type: 'checklist';
      title: string;
      items: DashboardChecklistItem[];
      style?: DashboardCardStyle;
    }
  // `date`: a calendar day, YYYY-MM-DD.
  | { type: 'key-date'; title: string; date: string; style?: DashboardCardStyle }
  | { type: 'links'; title: string; links: DashboardLink[]; style?: DashboardCardStyle }
  | SheetMetricContent
  | FormMetricContent;

type DashboardCardType = DashboardCardContent['type'];
// The cards written on the page (a sheet metric is filled from a Sheet instead).
export const DASHBOARD_CARD_TYPES = [
  'status',
  'checklist',
  'key-date',
  'links',
] as const satisfies readonly DashboardCardType[];

// A sheet's row or column id (@livepages/sheets AXIS_ID_PATTERN), as chart-source.ts reads one.
const AXIS_ID = /^[a-z0-9]{4,12}$/;
const readCell = (v: unknown): SheetMetricCell | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const { r, c } = v as Record<string, unknown>;
  return typeof r === 'string' && typeof c === 'string' && AXIS_ID.test(r) && AXIS_ID.test(c)
    ? { r, c }
    : undefined;
};

function readFormMetric(c: Record<string, unknown>): FormMetricContent | undefined {
  if (!(FORM_METRICS as readonly unknown[]).includes(c['metric'])) return undefined;
  const raw = c['formTabId'];
  return {
    type: 'form-metric',
    metric: c['metric'] as FormMetricKind,
    formTabId: typeof raw === 'string' && raw.length <= TAB_ID_MAX ? raw : '',
  };
}

function readSheetMetric(c: Record<string, unknown>): SheetMetricContent | undefined {
  if (!(SHEET_METRICS as readonly unknown[]).includes(c['metric'])) return undefined;
  const raw = c['sheetId'];
  const sheetId =
    typeof raw === 'string' && (raw === '' || PLAN_SHEET_ID_PATTERN.test(raw)) ? raw : '';
  const cell = readCell(c['cell']);
  const target = readCell(c['target']);
  const col = typeof c['col'] === 'string' && AXIS_ID.test(c['col']) ? c['col'] : undefined;
  const stat = (SHEET_METRIC_STATS as readonly unknown[]).includes(c['stat'])
    ? (c['stat'] as SheetMetricStat)
    : undefined;
  return {
    type: 'sheet-metric',
    metric: c['metric'] as SheetMetricKind,
    sheetId,
    ...(cell ? { cell } : {}),
    ...(target ? { target } : {}),
    ...(col ? { col } : {}),
    ...(stat ? { stat } : {}),
  };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// A link's address, made safe to open: http(s) or mailto only (never javascript: or data:), "https://" added to a bare
// host. Null for anything else.
export function safeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, DASHBOARD_LINK_URL_MAX);
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol === 'mailto:') return u.href;
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.'))
      return u.href;
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname === 'localhost')
      return u.href;
    return null;
  } catch {
    return null;
  }
}

function readItems(v: unknown): DashboardChecklistItem[] {
  if (!Array.isArray(v)) return [];
  const out: DashboardChecklistItem[] = [];
  for (const raw of v.slice(0, DASHBOARD_CHECKLIST_ITEMS_MAX)) {
    if (!raw || typeof raw !== 'object') continue;
    const i = raw as Record<string, unknown>;
    if (typeof i['id'] !== 'string') continue;
    out.push({
      id: i['id'],
      text: str(i['text'], DASHBOARD_CHECKLIST_ITEM_MAX),
      done: i['done'] === true,
    });
  }
  return out;
}

function readLinks(v: unknown): DashboardLink[] {
  if (!Array.isArray(v)) return [];
  const out: DashboardLink[] = [];
  for (const raw of v.slice(0, DASHBOARD_LINKS_MAX)) {
    if (!raw || typeof raw !== 'object') continue;
    const l = raw as Record<string, unknown>;
    if (typeof l['id'] !== 'string') continue;
    const label = str(l['label'], DASHBOARD_LINK_LABEL_MAX);
    if (typeof l['tabId'] === 'string') {
      out.push({ id: l['id'], label, tabId: l['tabId'] });
      continue;
    }
    const url = safeLinkUrl(l['url']);
    if (url) out.push({ id: l['id'], label, url });
  }
  return out;
}

// A stored card, read safely, or undefined for anything that is not one.
export function readDashboardCard(c: Record<string, unknown>): DashboardCardContent | undefined {
  switch (c['type']) {
    case 'status':
      return {
        type: 'status',
        state: (DASHBOARD_STATUSES as readonly unknown[]).includes(c['state'])
          ? (c['state'] as DashboardStatus)
          : 'on-track',
        text: str(c['text'], DASHBOARD_CARD_TEXT_MAX),
        at: typeof c['at'] === 'number' && Number.isFinite(c['at']) ? c['at'] : 0,
      };
    case 'checklist':
      return {
        type: 'checklist',
        title: str(c['title'], DASHBOARD_CARD_TITLE_MAX),
        items: readItems(c['items']),
      };
    case 'key-date':
      return {
        type: 'key-date',
        title: str(c['title'], DASHBOARD_CARD_TITLE_MAX),
        date: isCalendarDay(c['date']) ? c['date'] : '',
      };
    case 'sheet-metric':
      return readSheetMetric(c);
    case 'form-metric':
      return readFormMetric(c);
    case 'links':
      return {
        type: 'links',
        title: str(c['title'], DASHBOARD_CARD_TITLE_MAX),
        links: readLinks(c['links']),
      };
    default:
      return undefined;
  }
}

// The local calendar day `days` after `now`, as YYYY-MM-DD.
export function calendarDayAfter(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A new card of `type`, as it lands in a slot.
export function newDashboardCard(
  type: (typeof DASHBOARD_CARD_TYPES)[number],
  now: Date,
): DashboardCardContent {
  switch (type) {
    case 'status':
      return { type: 'status', state: 'on-track', text: '', at: now.getTime() };
    case 'checklist':
      return { type: 'checklist', title: 'Checklist', items: [] };
    case 'key-date':
      return { type: 'key-date', title: 'Key Date', date: calendarDayAfter(now, 14) };
    case 'links':
      return { type: 'links', title: 'Links', links: [] };
  }
}

// Whole days from `today` to `date` (both YYYY-MM-DD): negative once it has passed. Null for a date not set.
export function daysUntil(date: string, today: string): number | null {
  if (!isCalendarDay(date) || !isCalendarDay(today)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
