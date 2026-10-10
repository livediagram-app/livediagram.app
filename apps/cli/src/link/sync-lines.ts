// What a pass prints, one line per action (docs/specs/027-repositories/blueprints/repository-link.md "Output
// lines", final copy), then the totals. A document in step prints nothing of its own; it counts in the totals.

import type { MirrorLevel } from './link-file';
import type { SyncAction, TabMove } from './sync-plan';
import { plural } from '@livediagram/document';
import { oneLine } from '../output/one-line';

export type LineContext = {
  // A path relative to the mirror directory, as the working directory reaches it.
  pathOf: (rel: string) => string;
  level: MirrorLevel;
  relocate: boolean;
  linkHost: string;
};

export type Totals = {
  inStep: number;
  written: number;
  removed: number;
  refused: number;
  unreadable: number;
};

const quoted = (name: string) => JSON.stringify(name);

function writeLine(action: Extract<SyncAction, { kind: 'write' }>, lc: LineContext): string {
  const head = `${action.path === null ? '' : `${lc.pathOf(action.path)}  `}${quoted(action.name)}`;
  if (action.reason === 'new') {
    const revs = action.tabs.map((t) => t.to).join(',');
    return `+ ${head} · ${plural(action.tabs.length, 'tab')}${revs ? ` · rev ${revs}` : ''}`;
  }
  const moved = action.tabs.filter((t: TabMove) => t.from !== t.to);
  if (moved.length === 0) return `~ ${head}`;
  const revs = moved.map((t) => (t.from === null ? `${t.to}` : `${t.from}→${t.to}`)).join(', ');
  return `~ ${head} · ${moved.map((t) => oneLine(t.name)).join(', ')} · rev ${revs}`;
}

function refuseLine(action: Extract<SyncAction, { kind: 'refuse' }>, lc: LineContext): string {
  const p = lc.pathOf(action.path);
  const send = `livediagram push ${p}`;
  switch (action.reason) {
    case 'ahead':
      return `! ${p}: changed here; send it: ${send}`;
    case 'diverged':
      return `! ${p}: changed here and in livediagram; send it: ${send}`;
    case 'gone-changed':
      return `! ${p}: gone from the link, but changed here and not sent; kept. Send it: ${send}, or delete it`;
    case 'lowered-changed':
      return `! ${p}: level ${action.detail} keeps no mirror files, but this one changed here and is not sent; kept. Send it: ${send}, or delete it`;
    case 'conflicted':
      return `! ${p}: holds git conflict markers. Keep one side: git checkout --ours ${p} (or --theirs), then livediagram sync`;
    case 'invalid':
      return `! ${p}: ${action.detail}`;
    case 'foreign-host':
      return `! ${p}: synced from ${action.detail}, not this link's ${lc.linkHost}`;
    case 'duplicate':
      return `! ${p}: names the same document as ${lc.pathOf(action.detail!)}`;
  }
}

export function actionLine(action: SyncAction, lc: LineContext): string | null {
  switch (action.kind) {
    case 'none':
      return null;
    case 'write':
      return writeLine(action, lc);
    case 'remove':
      return `- ${action.path === null ? '' : `${lc.pathOf(action.path)}  `}${quoted(action.name)} · ${
        action.reason === 'trashed' ? 'in the Trash' : 'outside the link'
      }`;
    case 'lower':
      return `- ${lc.pathOf(action.path)}  ${quoted(action.name)} · level ${lc.level} keeps no mirror files`;
    case 'relocate':
      return lc.relocate
        ? `» ${lc.pathOf(action.path)} → ${lc.pathOf(action.to)}`
        : `» ${lc.pathOf(action.path)} would move to ${lc.pathOf(action.to)}: livediagram sync --relocate`;
    case 'report':
      return action.reason === 'unreadable'
        ? `? ${action.path === null ? action.documentId : lc.pathOf(action.path)}: no document this account can open; left as it is`
        : `? ${lc.pathOf(action.path!)}: a document written by hand; this version of livediagram does not create it`;
    case 'transient':
      return `! ${quoted(action.name)}: ${action.failure}; files kept`;
    case 'refuse':
      return refuseLine(action, lc);
    case 'held': {
      const p = lc.pathOf(action.path);
      return action.broken === 'conflicted'
        ? `! ${quoted(action.name)}: not written while ${p} holds git conflict markers. Keep one side: git checkout --ours ${p} (or --theirs), then livediagram sync`
        : `! ${quoted(action.name)}: not written while ${p} is invalid (${action.message}); fix or delete it, then livediagram sync`;
    }
  }
}

export function totalsLine(totals: Totals): string {
  const shown = [
    [totals.inStep, 'in step'],
    [totals.written, 'written'],
    [totals.removed, 'removed'],
    [totals.refused, 'refused'],
    [totals.unreadable, 'unreadable'],
  ] as const;
  const kept = shown.filter(([n]) => n > 0);
  return kept.length === 0 ? 'nothing to do' : kept.map(([n, what]) => `${n} ${what}`).join(' · ');
}
