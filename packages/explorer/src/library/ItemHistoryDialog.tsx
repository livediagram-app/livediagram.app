'use client';

// The History dialog on its own (livediagram/docs/specs/013-workspace/history.md "The dialog"), for an editor's footer
// Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md): the same dialog the Explorer's item menu opens, for
// the item the editor has open, without the Explorer on show. It needs only what the dialog reads from the Explorer's
// context (the index client, who is reading, their teams), so it stands the dialog in a provider of its own.
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { ExplorerProvider, type ExplorerProviderProps } from '../explorer/context';
import { HistoryDialog, type HistoryExtras } from './HistoryDialog';

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
      <HistoryDialog item={item} onClose={onClose} extras={extras} />
    </ExplorerProvider>
  );
}
