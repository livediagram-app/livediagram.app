'use client';

// The History dialog on its own (livediagram/docs/specs/013-workspace/history.md "The dialog"), for an editor's footer
// Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the same dialog the Explorer's item menu opens, for
// the item the editor has open, without the Explorer on show. It needs only what the dialog reads from the Explorer's
// context (the index client, who is reading, their teams), so it stands the dialog in a provider of its own.
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { ExplorerProvider, type ExplorerProviderProps } from '../explorer/context';
import { HistoryDialog, type HistoryExtras } from './HistoryDialog';
import { PeopleProvider } from '../explorer/extras';
import { ViewerLookContext, type ViewerLook } from './HistoryParts';
import type { ExplorerAccounts } from '../data/accounts';

const NOOP = () => {};

export function ItemHistoryDialog({
  app,
  client,
  itemHref,
  viewerId,
  teams,
  item,
  onClose,
  extras,
  accounts = null,
  viewerLook = null,
}: {
  app: ExplorerProviderProps['app'];
  client: IndexClient;
  itemHref: ExplorerProviderProps['itemHref'];
  viewerId: string | null;
  teams?: ExplorerProviderProps['teams'];
  item: Item;
  onClose: () => void;
  // What other tools add to it (Snapshots).
  extras?: HistoryExtras;
  // People's names and pictures (who did what, and their faces); without it they go unnamed.
  accounts?: ExplorerAccounts | null;
  // The reader's own avatar as their account menu draws it.
  viewerLook?: ViewerLook | null;
}) {
  return (
    <ExplorerProvider
      app={app}
      client={client}
      view={{ kind: 'all' }}
      filter="app"
      setFilter={NOOP}
      onNavigate={NOOP}
      itemHref={itemHref}
      onCreate={NOOP}
      viewerId={viewerId}
      teams={teams}
    >
      <PeopleProvider accounts={accounts}>
        <ViewerLookContext value={viewerLook}>
          <HistoryDialog item={item} onClose={onClose} extras={extras} />
        </ViewerLookContext>
      </PeopleProvider>
    </ExplorerProvider>
  );
}
