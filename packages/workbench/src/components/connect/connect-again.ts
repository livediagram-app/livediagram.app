// Connect Again (liveworkspace/docs/specs/004-index/connected-tabs.md "Opening"): a new connection to the same target in
// the same tab, under the same rules as connecting, at the target app's default role, one way. The index replaces the
// tab's old connection and its pass (IDX25); the editor's whole-tab save then puts the new one on the tab.
import {
  connectionDefaultLevel,
  type ConnectionMade,
  type IndexClient,
  type TabConnection,
} from '@liveworkspace/index-client';
import { workbench } from '../../bindings';
import { connectFile } from './connect-file';
import { setConnectedTabBroken } from './connected-tab-store';

export async function connectAgain({
  client,
  hostId,
  grant,
  tabId,
  connection,
  addTab,
}: {
  client: Pick<IndexClient, 'makeConnection' | 'takeBackConnection'>;
  hostId: string;
  grant: () => Promise<string | null>;
  tabId: string;
  connection: TabConnection;
  // The editor's whole-tab save of tab `tabId`, now holding `made.connection`.
  addTab: (made: ConnectionMade) => Promise<void>;
}): Promise<ConnectionMade> {
  const held = await grant();
  if (!held) throw new Error('no grant');
  const made = await connectFile({
    client,
    hostId,
    grant: held,
    tabId,
    targetId: connection.itemId,
    level: connectionDefaultLevel(connection.app),
    both: false,
    addTab,
  });
  setConnectedTabBroken(connection.id, false);
  workbench.track('Tab', 'Added', 'ConnectedAgain');
  return made;
}

/** The toast when both ways was asked and the other file could not be reached: the host's tab stands. */
export const reverseUnreachedWords = (name: string): string =>
  `${name} could not be reached, so it has no tab back here.`;
