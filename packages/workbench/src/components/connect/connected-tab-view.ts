// What a connected tab's page shows (liveworkspace/docs/specs/004-index/connected-tabs.md "Opening", "How it looks"):
// one state per way an open can end, and each state's words.
import { IndexError, type App } from '@liveworkspace/index-client';
import { appName } from './connect-words';

export type ConnectedTabView =
  | { state: 'opening' }
  // Opened in a new browser tab (another app); `href` for Open Again.
  | { state: 'opened'; href: string }
  // The target in the Trash, or purged.
  | { state: 'gone' }
  // Its pass was deleted (from the target's Share) or lapsed.
  | { state: 'link_removed' }
  // The tab came with a copy, an export or an import: the index knows its id for another host or tab.
  | { state: 'copy' }
  // The host is offline (a This Browser item, or no network).
  | { state: 'offline' }
  // Anything else: the network, the rate limit.
  | { state: 'failed' };

export type ConnectedTabState = ConnectedTabView['state'];

/** The view for a refused open. */
export function connectedTabViewOf(error: unknown): ConnectedTabView {
  if (error instanceof IndexError) {
    if (error.code === 'connection_target_gone') return { state: 'gone' };
    if (error.code === 'connection_link_removed') return { state: 'link_removed' };
    if (error.status === 404 && error.code === 'not_found') return { state: 'copy' };
  }
  return { state: 'failed' };
}

/** Whether a state is a tab that opens nothing until someone mends it (its tab's amber dot). */
export const isBrokenState = (state: ConnectedTabState): boolean =>
  state === 'gone' || state === 'link_removed' || state === 'copy';

export type ConnectedTabCopy = { title: string; line: string };

/** Each state's title and line; `canEdit` says whether the reader can mend it themselves. */
export function connectedTabCopy(
  state: ConnectedTabState,
  name: string,
  app: App,
  canEdit: boolean,
): ConnectedTabCopy {
  const ask = canEdit ? '' : ' Ask an editor to connect it again.';
  switch (state) {
    case 'opening':
      return { title: name, line: `Opening ${name} in ${appName(app)}…` };
    case 'opened':
      return { title: name, line: `${name} is open in a new tab.` };
    case 'gone':
      return {
        title: 'This file is no longer there.',
        line: canEdit
          ? `${name} was moved to the Trash or deleted. Remove this tab to tidy up.`
          : `${name} was moved to the Trash or deleted.`,
      };
    case 'link_removed':
      return {
        title: 'This connection’s link was removed.',
        line: `Its owner ended the link to ${name}.${ask}`,
      };
    case 'copy':
      return {
        title: `Connect this copy to ${name}.`,
        line: `This tab came with a copy, so it does not open ${name} yet.${ask}`,
      };
    case 'offline':
      return {
        title: 'Connected files open when you are online.',
        line: `${name} is in ${appName(app)}.`,
      };
    case 'failed':
      return {
        title: `${name} could not be opened just now.`,
        line: 'Check your connection and try again.',
      };
  }
}
