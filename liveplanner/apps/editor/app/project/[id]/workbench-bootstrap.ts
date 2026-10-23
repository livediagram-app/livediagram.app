// The editor's load in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor
// in a workbench", I9, "The workspace frame"): the session names the project and the person, so the address is
// not read. The person's participant record is read, never written; the load runs without the share-link
// prefetch, the Explorer lists or an open record; the level is the session's, never above the person's own access;
// the identity screen never opens; the session's tab, when it names one on the project, opens first.
//
// A workspace frame opening a project shared with the person opens it by its link, as the Explorer does (WB53):
// the link's code resolves the project and its role, the password gate asks when the link has one, and the code
// rides every later request of the project.
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { capWorkbenchRole, type Project, type ShareRole } from '@liveplanner/api-schema';
import type { WorkbenchProjectSession } from '@/components/providers/workbench-session-context';
import {
  apiLoadProject,
  apiLoadSelf,
  apiLoadShared,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
} from '@/lib/api-client';
import { isProjectTrashedError } from '@/lib/project-trashed';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { setLoadStep } from '@/lib/load-progress';
import { ensureCollabKey } from '@/lib/local-identity';

type SetState<T> = Dispatch<SetStateAction<T>>;

type WorkbenchBootstrapDeps = {
  workbench: Pick<
    WorkbenchProjectSession,
    'projectId' | 'tabId' | 'level' | 'person' | 'shareCode'
  >;
  seed: (
    selfId: string,
    fetched: Project,
    shareCode: string | null,
    firstTab: string | null,
  ) => Promise<void>;
  lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
  set: {
    setSelfParticipant: SetState<Participant>;
    setProjectId: SetState<string | null>;
    setProjectTrashed: (trashed: boolean) => void;
    setLoadError: SetState<boolean>;
    setProjectNotFound: SetState<boolean>;
    setProjectServerStored: (stored: boolean) => void;
    setIsOwner: SetState<boolean>;
    setSessionRole: SetState<ShareRole>;
    setNameConfirmed: SetState<boolean>;
    setHydrated: SetState<boolean>;
    setLoadingProject: SetState<boolean>;
    setSessionShareCode: SetState<string | null>;
    setSessionTabScope: (scope: string | null) => void;
    setSharePasswordGate: SetState<{ invalid: boolean } | null>;
  };
};

type Loaded = { project: Project; role: ShareRole; tabScope: string | null };
// The link asks for its password; `invalid` when the one sent was wrong.
type PasswordAsked = { password: { invalid: boolean } };

export async function loadWorkbenchProject({
  workbench,
  seed,
  lastPersistedSelfRef,
  set,
}: WorkbenchBootstrapDeps): Promise<void> {
  const { projectId, tabId, level, person, shareCode } = workbench;
  const settle = () => {
    // The person is who the session says: there is no name to confirm.
    set.setNameConfirmed(true);
    set.setHydrated(true);
    set.setLoadingProject(false);
  };

  setLoadStep('participant');
  const stored = await apiLoadSelf(person.id).catch(() => null);
  const self: Participant = {
    ...(stored ?? {
      id: person.id,
      name: person.name ?? randomName(),
      color: person.color ?? randomColor(),
    }),
    status: 'online',
  };
  set.setSelfParticipant({ ...self, key: ensureCollabKey() });
  // What the participant record holds already, so nothing echoes it back.
  lastPersistedSelfRef.current = { name: self.name, color: self.color };

  setLoadStep('project');
  set.setProjectId(projectId);
  let loaded: Loaded | 'gone' | PasswordAsked;
  try {
    loaded = shareCode
      ? await loadByLink(self.id, shareCode, projectId)
      : await loadAsOwner(self.id, projectId);
  } catch (err) {
    if (isProjectTrashedError(err)) set.setProjectTrashed(true);
    else set.setLoadError(true);
    settle();
    return;
  }
  if (loaded !== 'gone' && 'password' in loaded) {
    // The link has a password: the gate asks, and its answer runs this load again.
    set.setSharePasswordGate(loaded.password);
    set.setNameConfirmed(true);
    set.setLoadingProject(false);
    return;
  }
  if (loaded === 'gone' || loaded.project.id !== projectId) {
    set.setProjectNotFound(true);
    settle();
    return;
  }

  setLoadStep('first-tab');
  const { project: fetched, role, tabScope } = loaded;
  // A link scoped to one tab opens that tab, whatever the workbench asked for.
  if (tabScope !== null) set.setSessionTabScope(tabScope);
  const asked = tabScope ?? tabId;
  const firstTab = asked !== null && fetched.tabs.some((t) => t.id === asked) ? asked : null;
  await seed(self.id, fetched, shareCode, firstTab);
  set.setProjectServerStored(true);
  set.setIsOwner(fetched.ownerId === self.id);
  // The link's code rides every later request of the project.
  if (shareCode) set.setSessionShareCode(shareCode);
  // Never more than the token, never more than the person's own access to this project.
  set.setSessionRole(capWorkbenchRole(role, level));
  settle();
}

// The person's own access: their project, or their team's, at edit.
async function loadAsOwner(selfId: string, projectId: string): Promise<Loaded | 'gone'> {
  const fetched = await apiLoadProject(selfId, projectId);
  return fetched ? { project: fetched, role: 'edit', tabScope: null } : 'gone';
}

// A project shared with the person: the link's role and scope, its password remembered as the app remembers it.
async function loadByLink(
  selfId: string,
  shareCode: string,
  projectId: string,
): Promise<Loaded | 'gone' | PasswordAsked> {
  const cached = readCachedSharePassword(shareCode);
  if (cached && getSessionSharePassword() === null) setSessionSharePassword(cached);
  const resolution = await apiLoadShared(shareCode, selfId, projectId);
  if (!resolution) return 'gone';
  if ('passwordRequired' in resolution) {
    if (cached) {
      writeCachedSharePassword(shareCode, null);
      setSessionSharePassword(null);
    }
    return { password: { invalid: resolution.invalid } };
  }
  const accepted = getSessionSharePassword();
  if (accepted) writeCachedSharePassword(shareCode, accepted);
  return { project: resolution.project, role: resolution.role, tabScope: resolution.tabId };
}
