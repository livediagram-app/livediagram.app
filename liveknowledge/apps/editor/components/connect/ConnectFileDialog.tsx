'use client';

// Connect File, from the page tree (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the
// sidebar"): the shared Connect list (Recent, Find a file, the role, both ways) in a dialog. Picking a file makes the
// connection at the index, then adds the file's row to the tree through the editor's whole-tab save (connectFile
// takes the connection back when that save fails), and the dialog closes. A file already in the sidebar says
// Connected, and picking it goes to its row. Loaded only once Connect File is chosen, never with the editor.
import { useId } from 'react';
import type { ConnectionMade, Item } from '@liveworkspace/index-client';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { connectFileHeroArt } from '@liveworkspace/ui/dialog-hero-art/connect-file';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { connectFile } from '@liveworkspace/workbench/components/connect/connect-file';
import { useTickingNow } from '@liveworkspace/workbench/components/connect/ConnectFilePanel';
import {
  ConnectPicker,
  type ConnectChoice,
} from '@liveworkspace/workbench/components/connect/ConnectPicker';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { track } from '@/lib/telemetry';

export type ConnectFileDialogProps = {
  hostId: string;
  // The person may manage the knowledgebase's links (its owner, or a member of its team): both ways needs it.
  hostManaged: boolean;
  // The files already in the sidebar: item id to the row holding it.
  connected: ReadonlyMap<string, string>;
  // Where the row goes: under this page, or at the top level.
  parentName: string | null;
  grant: () => Promise<string | null>;
  // The row's add: the whole-tab save of a new tab `tabId` holding `made.connection`; throws when it fails.
  addRow: (made: ConnectionMade, tabId: string) => Promise<void>;
  onConnected: (tabId: string, made: ConnectionMade) => void;
  onGoTo: (tabId: string) => void;
  onOpenExplorer: () => void;
  onClose: () => void;
  client?: Parameters<typeof ConnectPicker>[0]['client'] &
    Parameters<typeof connectFile>[0]['client'];
};

export function ConnectFileDialog({
  hostId,
  hostManaged,
  connected,
  parentName,
  grant,
  addRow,
  onConnected,
  onGoTo,
  onOpenExplorer,
  onClose,
  client = indexClient,
}: ConnectFileDialogProps) {
  const titleId = useId();
  const now = useTickingNow();
  const onConnect = async (item: Item, choice: ConnectChoice) => {
    const held = await grant();
    // connectErrorWords' network line: the grant is the index's, so a missing one is the index out of reach.
    if (!held) throw new Error('no grant');
    const tabId = crypto.randomUUID();
    const made = await connectFile({
      client,
      hostId,
      grant: held,
      tabId,
      targetId: item.id,
      level: choice.level,
      both: choice.both,
      addTab: (answer) => addRow(answer, tabId),
    });
    track('Tab', 'Added', choice.both ? 'ConnectedBoth' : 'Connected');
    onConnected(tabId, made);
  };
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="lg" phoneSheet>
      <HeroDialogHeader
        art={connectFileHeroArt}
        titleId={titleId}
        title="Connect File"
        subtitle={
          parentName
            ? `Adds a file from another app under ${parentName}. Clicking it opens the file in a new tab.`
            : 'Adds a file from another app to the sidebar. Clicking it opens the file in a new tab.'
        }
        onClose={onClose}
      />
      <div data-connect-file-dialog="" className="px-6 pb-6 pt-5 max-sm:px-4">
        <ConnectPicker
          client={client}
          hostId={hostId}
          hostKind="knowledgebase"
          hostManaged={hostManaged}
          connected={connected}
          now={now}
          onConnect={onConnect}
          onGoTo={onGoTo}
          onOpenExplorer={onOpenExplorer}
        />
      </div>
    </Dialog>
  );
}
