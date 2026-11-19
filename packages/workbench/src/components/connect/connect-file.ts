// One connect from the Connect list (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the index makes
// the connection and its pass, then the app puts the tab in through its own whole-tab save. When that save fails the
// connection is taken back at once (Work Tracker #571), so no pass outlives a tab that never appeared. A file made
// beside the host from a template's offer ("A file made beside it", Work Tracker 1281) is the same, with the index
// making the file first.
import type {
  BesideOfferId,
  ConnectionMade,
  IndexClient,
  Level,
} from '@liveworkspace/index-client';

type Common = {
  client: Pick<IndexClient, 'takeBackConnection'>;
  // The host's grant at `edit` (X-Index-Grant).
  grant: string;
  // The app's tab add: a new tab, named `made.name`, holding `made.connection`, at the end of the bar.
  addTab: (made: ConnectionMade) => Promise<void>;
};

// The tab put in for a connection the index made; taken back when the add fails.
async function addOrTakeBack(
  made: ConnectionMade,
  { client, grant, addTab }: Common,
): Promise<ConnectionMade> {
  try {
    await addTab(made);
  } catch (error) {
    // The add's own failure is what the person hears; a lost take-back is left to the index's sweep (IDX27).
    await client.takeBackConnection(made.connection.id, grant).catch(() => {});
    throw error;
  }
  return made;
}

export async function connectFile({
  client,
  hostId,
  grant,
  tabId,
  targetId,
  level,
  both,
  addTab,
}: Common & {
  client: Pick<IndexClient, 'makeConnection' | 'takeBackConnection'>;
  hostId: string;
  // The new tab's id, minted by the app before the call.
  tabId: string;
  targetId: string;
  level: Level;
  both: boolean;
}): Promise<ConnectionMade> {
  const made = await client.makeConnection(hostId, { targetId, tabId, level, both }, grant);
  return addOrTakeBack(made, { client, grant, addTab });
}

/** Make a plan beside it: the index makes the offer's file and connects it in `tabId`, then the tab goes in. */
export async function makeBeside({
  client,
  hostId,
  grant,
  tabId,
  offer,
  level,
  both,
  addTab,
}: Common & {
  client: Pick<IndexClient, 'makeBeside' | 'takeBackConnection'>;
  hostId: string;
  tabId: string;
  offer: BesideOfferId;
  level: Level;
  both: boolean;
}): Promise<ConnectionMade> {
  const made = await client.makeBeside(hostId, { offer, tabId, level, both }, grant);
  return addOrTakeBack(made, { client, grant, addTab });
}
