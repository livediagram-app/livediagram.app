// The editor's load in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor
// in a workbench", I9): the session names the document and the person, so neither the address nor a
// share code is read. The person's participant record is read, never written; the owner's load runs
// without the share-link prefetch, the Explorer lists or an open record; the level is the session's;
// the identity screen never opens; the session's tab, when it names one on the document, opens first.
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { LiveDoc, ShareRole } from '@livediagram/api-schema';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import { apiLoadDocument, apiLoadSelf } from '@/lib/api-client';
import { isDocumentTrashedError } from '@/lib/document-trashed';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { setLoadStep } from '@/lib/load-progress';
import { ensureCollabKey } from '@/lib/local-identity';

type SetState<T> = Dispatch<SetStateAction<T>>;

export type WorkbenchBootstrapDeps = {
  workbench: Pick<WorkbenchSession, 'documentId' | 'tabId' | 'level' | 'person'>;
  seed: (
    selfId: string,
    fetched: LiveDoc,
    shareCode: null,
    firstTab: string | null,
  ) => Promise<void>;
  lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
  set: {
    setSelfParticipant: SetState<Participant>;
    setDocumentId: SetState<string | null>;
    setDocumentTrashed: (trashed: boolean) => void;
    setLoadError: SetState<boolean>;
    setDocumentNotFound: SetState<boolean>;
    setDocumentServerStored: (stored: boolean) => void;
    setIsOwner: SetState<boolean>;
    setSessionRole: SetState<ShareRole>;
    setNameConfirmed: SetState<boolean>;
    setHydrated: SetState<boolean>;
    setLoadingDocument: SetState<boolean>;
  };
};

export async function loadWorkbenchDocument({
  workbench,
  seed,
  lastPersistedSelfRef,
  set,
}: WorkbenchBootstrapDeps): Promise<void> {
  const { documentId, tabId, level, person } = workbench;
  const settle = () => {
    // The person is who the session says: there is no name to confirm.
    set.setNameConfirmed(true);
    set.setHydrated(true);
    set.setLoadingDocument(false);
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

  setLoadStep('document');
  set.setDocumentId(documentId);
  let fetched: LiveDoc | null;
  try {
    fetched = await apiLoadDocument(self.id, documentId);
  } catch (err) {
    if (isDocumentTrashedError(err)) set.setDocumentTrashed(true);
    else set.setLoadError(true);
    settle();
    return;
  }
  if (!fetched) {
    set.setDocumentNotFound(true);
    settle();
    return;
  }

  setLoadStep('first-tab');
  const firstTab = tabId !== null && fetched.tabs.some((t) => t.id === tabId) ? tabId : null;
  await seed(self.id, fetched, null, firstTab);
  set.setDocumentServerStored(true);
  set.setIsOwner(fetched.ownerId === self.id);
  set.setSessionRole(level);
  settle();
}
