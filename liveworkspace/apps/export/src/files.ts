// What goes in the zip besides the apps' own files (liveworkspace/docs/specs/003-accounts/data-export.md "What is in
// the zip"): names safe on every file system, each item's folder and files, the comments as JSON and CSV, and the
// README. Pure: the job hands in what it read.

import type { ExportThread } from '@liveworkspace/index-app';
import type { App } from '@liveworkspace/index-client';

export const NAME_MAX = 80;

// Characters no file system takes in a name, and control characters.
// oxlint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f]+/g;

/** A name made safe for a file or folder: unsafe characters become spaces, trimmed, at most NAME_MAX characters. */
export function safeName(name: string, fallback = 'Untitled'): string {
  const clean = name.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').trim();
  const cut = [...clean].slice(0, NAME_MAX).join('').trim();
  return cut || fallback;
}

/** The folder an item's files go in: its app, then its name and id, so two of the same name never collide. */
export function itemFolder(app: App, name: string, id: string): string {
  return `${app}/${safeName(name)} (${safeName(id, 'item')})`;
}

/** The app's file extension, as Drive names the file (drive.md "The file"). */
export const APP_EXTENSION: Record<App, string> = {
  livediagram: 'livediagram',
  liveplanner: 'liveplanner',
  livedocuments: 'livedocuments',
  livedesign: 'livedesign',
};

/** The tabs a whole-item envelope holds, in order: `{ kind, …, <noun>: { tabs: [{ id, name }] } }`. */
export function tabsOfEnvelope(text: string): { id: string; name: string }[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== 'object') return [];
  for (const value of Object.values(raw as Record<string, unknown>)) {
    const tabs = (value as { tabs?: unknown } | null)?.tabs;
    if (!Array.isArray(tabs)) continue;
    return tabs.flatMap((tab: unknown) => {
      const t = tab as { id?: unknown; name?: unknown } | null;
      return typeof t?.id === 'string'
        ? [{ id: t.id, name: typeof t.name === 'string' ? t.name : '' }]
        : [];
    });
  }
  return [];
}

/** A list of names made unique by numbering the repeats (`Sprint`, `Sprint 2`), case-insensitively. */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? name : `${name} ${count}`;
  });
}

/** Each tab's picture's file name, numbered in order: `01 Overview.png`. */
export function pictureNames(tabs: readonly { name: string }[]): string[] {
  const width = Math.max(2, String(tabs.length).length);
  return tabs.map(
    (tab, i) => `${String(i + 1).padStart(width, '0')} ${safeName(tab.name, 'Tab')}.png`,
  );
}

// ---------- Comments -------------------------------------------------------------------------------------------

/** One comment as the export lists it: where it is, who wrote it, when and what. */
export type CommentRow = {
  app: App;
  itemId: string;
  itemName: string;
  tabName: string | null;
  threadId: string;
  on: string | null;
  resolved: boolean;
  commentId: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: number | null;
  text: string;
};

/** An item's threads as rows: every comment for a team's export, only the person's own (`onlyBy`) for theirs. */
export function commentRows(
  item: { app: App; id: string; name: string },
  threads: readonly ExportThread[],
  onlyBy: string | null,
): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const thread of threads) {
    for (const comment of thread.comments) {
      if (onlyBy !== null && comment.authorId !== onlyBy) continue;
      rows.push({
        app: item.app,
        itemId: item.id,
        itemName: item.name,
        tabName: thread.tabName,
        threadId: thread.id,
        on: thread.on,
        resolved: thread.resolved,
        commentId: comment.id,
        authorId: comment.authorId,
        authorName: comment.authorName,
        createdAt: comment.createdAt,
        text: comment.text,
      });
    }
  }
  return rows;
}

// A field a spreadsheet would run as a formula starts with one of these: it is opened with an apostrophe.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

const iso = (at: number | null) => (at === null ? '' : new Date(at).toISOString());

export function commentsCsv(rows: readonly CommentRow[]): string {
  return toCsv([
    [
      'App',
      'Item',
      'Item ID',
      'Tab',
      'Thread',
      'Resolved',
      'Author',
      'Author ID',
      'Written At',
      'Comment',
    ],
    ...rows.map((r) => [
      r.app,
      r.itemName,
      r.itemId,
      r.tabName ?? '',
      r.threadId,
      r.resolved ? 'Yes' : 'No',
      r.authorName ?? '',
      r.authorId ?? '',
      iso(r.createdAt),
      r.text,
    ]),
  ]);
}

export function commentsJson(rows: readonly CommentRow[]): string {
  return JSON.stringify(
    rows.map((r) => ({ ...r, createdAt: r.createdAt === null ? null : iso(r.createdAt) })),
    null,
    2,
  );
}

// ---------- README ---------------------------------------------------------------------------------------------

export type ReadmeFacts = {
  kind: 'personal' | 'team';
  teamName: string | null;
  madeAt: number;
  items: number;
  images: number;
  comments: number;
  leftOut: number;
  problems: readonly { app: App; name: string; reason: string }[];
};

export function readme(facts: ReadmeFacts): string {
  const whose =
    facts.kind === 'team' ? (facts.teamName ? `the ${facts.teamName} team` : 'your team') : 'you';
  const lines = [
    'Your liveworkspace data',
    '=======================',
    '',
    `Everything ${whose} owned in livediagram, liveplanner, livedocuments and livedesign on`,
    `${iso(facts.madeAt).slice(0, 10)}: ${facts.items} item${facts.items === 1 ? '' : 's'}, ${facts.comments} comment${facts.comments === 1 ? '' : 's'}${facts.kind === 'personal' ? ` and ${facts.images} image${facts.images === 1 ? '' : 's'}` : ''}.`,
    '',
    'What is where',
    '-------------',
    '',
    'livediagram/, liveplanner/, livedocuments/, livedesign/',
    '    One folder per item, named after the item and its id. In each:',
    '    - <Name>.<app>   the whole item as JSON: every tab, element and setting, exactly as',
    '                     liveworkspace keeps it. This is the file to keep, and to bring back.',
    '    - 01 <Tab>.png   a picture of each tab, in order, to read without the app.',
    "    - <Name>.csv     liveplanner only: each board's cards and each sheet's cells, for a spreadsheet.",
    '',
    facts.kind === 'personal'
      ? 'comments.json, comments.csv\n    Every comment you wrote in the items here, with its item, tab and time.'
      : "comments.json, comments.csv\n    Every comment in the team's items, with its author, item, tab and time.",
    '',
    facts.kind === 'personal'
      ? 'profile.json\n    Your account: your name, email, colour, teams and settings.\n\nimages/\n    Every image you uploaded, in any app, as you uploaded it.'
      : "team.json\n    The team's name and id.",
    '',
    'Bringing an item back',
    '---------------------',
    '',
    "Each item's .livediagram, .liveplanner, .livedocuments or .livedesign file is the same file",
    'liveworkspace writes to Google Drive. To make a new item from one: put the file in your',
    'Google Drive, right-click it, choose Open with > liveworkspace, then Import as a copy.',
    'The file is plain JSON, so any program can read it too.',
  ];
  if (facts.leftOut > 0) {
    lines.push(
      '',
      'Left out',
      '--------',
      '',
      `This download reached its size limit, so ${facts.leftOut} item${facts.leftOut === 1 ? ' was' : 's were'} left out.`,
      'Download the rest from each app with Export, or ask for a new download once you have tidied up.',
    );
  }
  if (facts.problems.length > 0) {
    lines.push(
      '',
      'Not included',
      '------------',
      '',
      'These items could not be read when this was made:',
      '',
    );
    for (const p of facts.problems) lines.push(`- ${p.app}: ${p.name} (${p.reason})`);
  }
  return lines.join('\n') + '\n';
}
