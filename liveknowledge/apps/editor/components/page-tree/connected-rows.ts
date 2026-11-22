// What the page tree is handed for its connected rows (docs/specs/030-knowledgebase/links-and-embeds.md "Connected
// files in the sidebar"): where each leads (the store), whether Connect File is offered, and the row's verbs. The
// tree's own verbs (move, indent) are a page's.
import type { App } from '@liveworkspace/index-client';
import { appName } from '@liveworkspace/workbench/components/connect/connect-words';
import type { ConnectedRowBroken, ConnectedRowStore } from '@/lib/knowledge/connected-row-store';

export type PageTreeConnected = {
  store: ConnectedRowStore;
  // Connect File is offered: signed in, a knowledgebase on the server, a session that may change the tree.
  canConnect: boolean;
  // Opens the Connect File dialog for a row placed under `parent` (the top level when absent).
  onConnect: (parent?: string) => void;
  // Opens the file in a new browser tab: a press on a row whose address is not known yet, Enter, the menu's Open.
  onOpen: (id: string) => void;
  onCopyLink: (id: string) => void;
  onRemove: (id: string) => void;
  onConnectAgain: (id: string) => void;
};

/** Why a connected row opens nothing, as its Can't Open hover card says it. */
export function cantOpenWords(reason: ConnectedRowBroken, app: App, canEdit: boolean): string {
  const fix = canEdit ? '' : ' Ask an editor to connect it again.';
  switch (reason) {
    case 'gone':
      return `This file was moved to the Trash or deleted in ${appName(app)}. Remove it from the sidebar to tidy up.`;
    case 'link_removed':
      return `Its owner removed the link to this file, so it no longer opens from here.${fix}`;
    case 'copy':
      return `This row came with a copy or an import, so it does not open its file yet.${fix}`;
  }
}

/** Whether Connect Again can mend a broken row: a removed link or a copy's row, never a file that is gone. */
export const canConnectAgain = (reason: ConnectedRowBroken): boolean => reason !== 'gone';
