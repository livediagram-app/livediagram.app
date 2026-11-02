'use client';

// Teams for every Explorer surface (packages/explorer/README.md "Teams"): the host's TeamsHost, the teams to show
// (the token's, or accounts' list once read, with the changes made here laid over them), and the changes themselves,
// each of which keeps the list, the overlay and the host's token in step. The page reads accounts' list once as it
// opens (`eager`: the Invites badge and member counts); the editor's panel never does, and asks about a team only
// when its Members dialog opens.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { TeamRef } from '../types';
import { isAbort } from '../data/errors';
import { applyTeamChanges, teamChanges } from '../data/teamChanges';
import type {
  AnsweredInvitation,
  MyTeams,
  PendingInvitation,
  RemovedMember,
  TeamResult,
  TeamsHost,
} from '../data/teams';

export type TeamsContext = {
  host: TeamsHost | null;
  // Teams can be made and run here: a TeamsHost, signed in.
  canRun: boolean;
  /** Accounts' list (member counts, the invitations waiting); null until read, and never in the panel. */
  myTeams: MyTeams | null;
  /** The last read of accounts' list failed (offline, refused), so `myTeams` is null for good until `retryMyTeams`. */
  myTeamsFailed: boolean;
  retryMyTeams: () => void;
  /** The teams to show. */
  teams: TeamRef[];
  create: (input: { name: string; organisation?: string | null }) => Promise<TeamResult<TeamRef>>;
  update: (
    teamId: string,
    patch: { name?: string; organisation?: string | null },
  ) => Promise<TeamResult<TeamRef & { organisation: string | null }>>;
  remove: (teamId: string) => Promise<TeamResult<null>>;
  removeMember: (teamId: string, memberId: string) => Promise<TeamResult<RemovedMember>>;
  answer: (
    invitation: PendingInvitation,
    accept: boolean,
  ) => Promise<TeamResult<AnsweredInvitation>>;
};

const NO_TEAMS: TeamRef[] = [];
const NO_HOST = { ok: false as const, error: 'signed_out' };

const QUIET: TeamsContext = {
  host: null,
  canRun: false,
  myTeams: null,
  myTeamsFailed: false,
  retryMyTeams: () => {},
  teams: NO_TEAMS,
  create: async () => NO_HOST,
  update: async () => NO_HOST,
  remove: async () => NO_HOST,
  removeMember: async () => NO_HOST,
  answer: async () => NO_HOST,
};

const Ctx = createContext<TeamsContext | null>(null);

export function useTeams(): TeamsContext {
  return useContext(Ctx) ?? QUIET;
}

/** Accounts' list, read once as the page opens (signed in, with a host) and again after a change. */
function useMyTeams(host: TeamsHost | null, read: boolean) {
  const [mine, setMine] = useState<MyTeams | null>(null);
  const [failed, setFailed] = useState(false);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    setFailed(false);
    if (!host || !read) {
      setMine(null);
      return;
    }
    const controller = new AbortController();
    host.myTeams(controller.signal).then(setMine, (e: unknown) => {
      // Without it the badges stay away and the token's teams show; Invites says it couldn't load.
      if (isAbort(e)) return;
      setMine(null);
      setFailed(true);
    });
    return () => controller.abort();
  }, [host, read, epoch]);
  const refresh = useCallback(() => setEpoch((n) => n + 1), []);
  return [mine, setMine, refresh, failed] as const;
}

export function TeamsProvider({
  host = null,
  signedIn,
  tokenTeams = NO_TEAMS,
  eager,
  children,
}: {
  host?: TeamsHost | null;
  signedIn: boolean;
  /** The teams the person's token names. */
  tokenTeams?: TeamRef[];
  /** Read accounts' list as it opens (the page); the panel leaves it. */
  eager: boolean;
  children: ReactNode;
}) {
  const live = signedIn ? host : null;
  const [myTeams, setMyTeams, refresh, myTeamsFailed] = useMyTeams(live, eager);
  const changes = useSyncExternalStore(
    teamChanges.subscribe,
    teamChanges.snapshot,
    teamChanges.snapshot,
  );
  const known = useMemo<TeamRef[]>(
    () => (myTeams ? myTeams.teams.map((t) => ({ id: t.id, name: t.name })) : tokenTeams),
    [myTeams, tokenTeams],
  );
  const teams = useMemo(() => applyTeamChanges(known, changes), [known, changes]);

  // After a change to the person's teams: the host renews its token, and the page reads the list again.
  const changed = useCallback(() => {
    void Promise.resolve(live?.onTeamsChanged?.()).catch(() => {});
    if (eager) refresh();
  }, [live, eager, refresh]);

  const value = useMemo<TeamsContext>(() => {
    if (!live) return { ...QUIET, teams, myTeams };
    return {
      host: live,
      canRun: true,
      myTeams,
      myTeamsFailed,
      retryMyTeams: refresh,
      teams,
      create: async (input) => {
        const result = await live.create(input);
        if (result.ok) {
          teamChanges.made(result.value);
          changed();
        }
        return result;
      },
      update: async (teamId, patch) => {
        const result = await live.update(teamId, patch);
        if (result.ok) {
          teamChanges.renamed(teamId, result.value.name);
          changed();
        }
        return result;
      },
      remove: async (teamId) => {
        const result = await live.remove(teamId);
        if (result.ok) {
          teamChanges.gone(teamId);
          changed();
        }
        return result;
      },
      removeMember: async (teamId, memberId) => {
        const result = await live.removeMember(teamId, memberId);
        if (result.ok && (result.value.removed === 'self' || result.value.teamDeleted)) {
          teamChanges.gone(teamId);
          changed();
        }
        return result;
      },
      answer: async (invitation, accept) => {
        const result = await live.answer(invitation.id, accept);
        // Answered either way (or answered elsewhere): the card goes at once.
        if (result.ok || result.error === 'not_found') {
          setMyTeams((was) =>
            was
              ? { ...was, invitations: was.invitations.filter((i) => i.id !== invitation.id) }
              : was,
          );
        }
        if (result.ok && result.value.status === 'joined') {
          teamChanges.made({ id: result.value.teamId, name: result.value.teamName });
          changed();
        }
        return result;
      },
    };
  }, [live, teams, myTeams, myTeamsFailed, refresh, changed, setMyTeams]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
