// The words of a live embed (liveworkspace/docs/specs/004-index/live-embeds.md "What a reader sees", "Making one"), in
// one place so the face, the picker and their tests say the same.
import type { Level } from '@liveworkspace/index-client';
import type { LiveEmbedApp } from '@liveworkspace/element-model/live-item';
import { appName } from '../connect/connect-words';

// What each role lets the host's readers do with the file, through the tab Embed File adds.
const LEVEL_VERBS: Record<Level, string> = {
  edit: 'edit',
  participate: 'take part in',
  view: 'view',
};

/** Embed File's role, read out with its switch (live-embeds.md "Making one"): the tab's role, never the embed's. */
export function liveEmbedRoleLine(level: Level, hostKind: string): string {
  return `Anyone who can open this ${hostKind} can ${LEVEL_VERBS[level]} the file you embed, through its tab. The embed itself is read-only.`;
}

// The name to show: the snapshot's, else the app's word for a file.
export const liveNameOr = (name: string | undefined, app: LiveEmbedApp | undefined): string =>
  name?.trim() || (app ? `this ${appName(app)} file` : 'this file');

export const liveEmbedWords = {
  emptyTitle: (canChoose: boolean) =>
    canChoose ? 'Double-click to choose a file' : 'No file chosen yet',
  emptyLine: 'A canvas, plan, page, design or knowledgebase from our apps, live and read-only.',
  // The dialog that makes one, and the tile, menu entry and Slot Settings action that open it (Work Tracker 1375).
  title: 'Embed File',
  subtitle:
    'Show a file from any of our apps here, live and read-only. Everyone sees it with their own access.',
  // A row Embed File cannot add a tab for: only people who can open the file see it.
  noTab: 'Embeds with no tab',
  noAccess: (name: string) => `You don't have access to ${name}.`,
  noAccessLine: 'Ask its owner to share it with you.',
  gone: 'This file is no longer there.',
  goneLine: (canChoose: boolean) =>
    canChoose ? 'Double-click to choose another.' : 'It was deleted or moved to the Trash.',
  failed: (name: string) => `${name} could not be shown just now.`,
  tryAgain: 'Try Again',
  open: (app: LiveEmbedApp) => `Open in ${appName(app)}`,
  use: 'Use the file',
  stopUsing: 'Done using the file',
  loading: (name: string) => `Opening ${name}`,
  live: 'Live',
};
