'use client';

// Where an editor offers Approvals (liveworkspace/docs/specs/004-index/approvals.md "In the editor"): the app's host
// builds a door from its gate (a signed-in account on a stored item, not a workbench frame, an embed or a Community
// visit) and hands it to the provider, or null for nobody. The provider reads the item's approval once, again when the
// browser tab comes back into view (at most every 30 seconds), and after each of the reader's own changes; the badge,
// the banner and the Share dialog's Approval tab read it from here. Nothing is read without a door.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Approval, IndexClient, ShareAccess } from '@liveworkspace/index-client';

/** How often a tab coming back into view reads the approval again, at most. */
export const APPROVAL_REFRESH_MS = 30_000;

export type ApprovalClient = Pick<
  IndexClient,
  'getApproval' | 'requestApproval' | 'decideApproval' | 'cancelApproval' | 'approvalPeople'
>;

/** A team member the host can name, for the Approvers list. */
export type ApprovalTeamPerson = { id: string; name: string | null };

export type ApprovalDoor = {
  client: ApprovalClient;
  itemId: string;
  share: ShareAccess | null;
  /** The reader's account id. */
  viewerId: string;
  /** An Editor of the whole item: asks, cancels, and has the Share dialog's Approval tab. */
  canRequest: boolean;
  /** What the item is called in this app: document, design. */
  noun: string;
  /** The item's team's joined members, for a team item. */
  loadTeamPeople?: (() => Promise<ApprovalTeamPerson[]>) | null;
  /** Saves the item as it is now as a snapshot, answering its id, where the editor offers Snapshots. */
  takeSnapshot?: (() => Promise<string>) | null;
  /** Opens the Share dialog (the badge opens it on the Approval tab). */
  openShare?: (() => void) | null;
};

export type ApprovalContext = {
  door: ApprovalDoor;
  approval: Approval | null;
  loaded: boolean;
  failed: boolean;
  refresh: () => void;
  /** Takes an answer the reader's own change brought back. */
  setApproval: (approval: Approval | null) => void;
  /** Opens the Share dialog on the Approval tab. */
  openApprovalTab: (() => void) | null;
  /** Whether the Share dialog should open on the Approval tab, once: reading it clears it. */
  takeStartTab: () => boolean;
};

const Context = createContext<ApprovalContext | null>(null);

/** The open door with the item's approval, or null where Approvals are not offered. */
export function useApprovalDoor(): ApprovalContext | null {
  return useContext(Context);
}

/** A team member as an app's team read answers. */
export type ApprovalTeamMember = { userId: string | null; name: string | null; status: string };

/** The editor's door from its session: a signed-in account (never a guest) on a stored item, never Offline,
 *  an embed or the workbench frame, and never before the editor knows who is asking. The index answers a Community
 *  visitor with no approval and refuses everyone else all the same, so this is presentation. The app hands in its
 *  team read and its Snapshots api (null where it offers none); the door keeps one identity while they change. */
export function useEditorApprovalDoor(input: {
  hydrated: boolean;
  isOffline: boolean;
  embedMode: boolean;
  workbench: unknown;
  /** The reader's account id, null for a guest or before sign-in is known. */
  accountId: string | null;
  itemId: string | null;
  teamId: string | null;
  /** The session's level, and whether a tab-scoped link holds its structure read-only: an Editor of the whole item
   *  asks and cancels (share-roles.md); every level may answer when named. */
  level: string;
  isStructureReadOnly: boolean;
  shareCode: string | null;
  client: ApprovalClient;
  noun: string;
  teamMembers: (accountId: string, teamId: string) => Promise<ApprovalTeamMember[]>;
  snapshots: { take: (name: string) => Promise<{ id: string }> } | null;
  setShareOpen: (open: boolean) => void;
}): ApprovalDoor | null {
  const allowed =
    input.hydrated &&
    !input.isOffline &&
    !input.embedMode &&
    !input.workbench &&
    input.accountId !== null &&
    input.itemId !== null;
  const { accountId, itemId, teamId, shareCode, client, noun } = input;
  const wholeEditor = input.level === 'edit' && !input.isStructureReadOnly;
  const live = useRef(input);
  live.current = input;
  const hasSnapshots = input.snapshots !== null;
  const loadTeamPeople = useCallback(async (): Promise<ApprovalTeamPerson[]> => {
    const { accountId: me, teamId: team, teamMembers } = live.current;
    if (!me || !team) return [];
    const members = await teamMembers(me, team);
    return members.flatMap((m) =>
      m.userId && m.status === 'joined' ? [{ id: m.userId, name: m.name }] : [],
    );
  }, []);
  const takeSnapshot = useCallback(async () => {
    const api = live.current.snapshots;
    if (!api) throw new Error('no snapshots');
    return (await api.take('Sent for approval')).id;
  }, []);
  const openShare = useCallback(() => live.current.setShareOpen(true), []);
  return useMemo(
    () =>
      allowed
        ? {
            client,
            itemId: itemId!,
            share: shareCode ? { code: shareCode } : null,
            viewerId: accountId!,
            canRequest: wholeEditor,
            noun,
            loadTeamPeople: teamId ? loadTeamPeople : null,
            takeSnapshot: wholeEditor && hasSnapshots ? takeSnapshot : null,
            openShare,
          }
        : null,
    [
      allowed,
      client,
      itemId,
      teamId,
      shareCode,
      accountId,
      wholeEditor,
      noun,
      hasSnapshots,
      loadTeamPeople,
      takeSnapshot,
      openShare,
    ],
  );
}

export function ApprovalDoorProvider({
  door,
  children,
}: {
  door: ApprovalDoor | null;
  children: ReactNode;
}) {
  const [approval, setApproval] = useState<Approval | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastRead = useRef(0);
  const reading = useRef<AbortController | null>(null);
  const startTab = useRef(false);
  const client = door?.client;
  const itemId = door?.itemId;
  const code = door?.share?.code ?? null;

  const read = useCallback(() => {
    if (!client || !itemId) return;
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    lastRead.current = Date.now();
    client
      .getApproval(itemId, code ? { code } : null, { signal: controller.signal })
      .then(({ approval: next }) => {
        if (controller.signal.aborted) return;
        setApproval(next);
        setFailed(false);
        setLoaded(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoaded(true);
      });
  }, [client, itemId, code]);

  useEffect(() => {
    setApproval(null);
    setLoaded(false);
    setFailed(false);
    if (!client || !itemId) return;
    read();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRead.current < APPROVAL_REFRESH_MS) return;
      read();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      reading.current?.abort();
    };
  }, [client, itemId, read]);

  const openShare = door?.openShare ?? null;
  const canRequest = door?.canRequest ?? false;
  const value = useMemo<ApprovalContext | null>(
    () =>
      door
        ? {
            door,
            approval,
            loaded,
            failed,
            refresh: read,
            setApproval: (next) => {
              lastRead.current = Date.now();
              setApproval(next);
              setFailed(false);
            },
            openApprovalTab:
              openShare && canRequest
                ? () => {
                    startTab.current = true;
                    openShare();
                  }
                : null,
            takeStartTab: () => {
              const start = startTab.current;
              startTab.current = false;
              return start;
            },
          }
        : null,
    [door, approval, loaded, failed, read, openShare, canRequest],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
