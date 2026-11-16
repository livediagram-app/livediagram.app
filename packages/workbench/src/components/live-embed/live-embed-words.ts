// The words of a live embed (liveworkspace/docs/specs/004-index/live-embeds.md "What a reader sees", "Making one"), in
// one place so the face, the picker and their tests say the same.
import type { LiveEmbedApp } from '@liveworkspace/element-model/live-item';
import { appName } from '../connect/connect-words';

// The name to show: the snapshot's, else the app's word for a file.
export const liveNameOr = (name: string | undefined, app: LiveEmbedApp | undefined): string =>
  name?.trim() || (app ? `this ${appName(app)} file` : 'this file');

export const liveEmbedWords = {
  emptyTitle: (canChoose: boolean) =>
    canChoose ? 'Double-click to choose a file' : 'No file chosen yet',
  emptyLine: 'A canvas, plan, page or design from our apps, live and read-only.',
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
