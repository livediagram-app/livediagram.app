// One connect from the Connect list (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the index makes
// the connection and its pass, then the app puts the tab in through its own whole-tab save. When that save fails the
// connection is taken back at once (Work Tracker #571), so no pass outlives a tab that never appeared.
import type { ConnectionMade, IndexClient, Level } from '@liveworkspace/index-client';

export async function connectFile({
  client,
  hostId,
  grant,
  tabId,
  targetId,
  level,
  both,
  addTab,
}: {
  client: Pick<IndexClient, 'makeConnection' | 'takeBackConnection'>;
  hostId: string;
  // The host's grant at `edit` (X-Index-Grant).
  grant: string;
  // The new tab's id, minted by the app before the call.
  tabId: string;
  targetId: string;
  level: Level;
  both: boolean;
  // The app's tab add: a new tab `tabId`, named `made.name`, holding `made.connection`, at the end of the bar.
  addTab: (made: ConnectionMade) => Promise<void>;
}): Promise<ConnectionMade> {
  const made = await client.makeConnection(hostId, { targetId, tabId, level, both }, grant);
  try {
    await addTab(made);
  } catch (error) {
    // The add's own failure is what the person hears; a lost take-back is left to the index's sweep (IDX27).
    await client.takeBackConnection(made.connection.id, grant).catch(() => {});
    throw error;
  }
  return made;
}
