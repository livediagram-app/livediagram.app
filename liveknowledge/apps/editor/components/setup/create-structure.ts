// A structure's pages made in the open knowledgebase (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow",
// step 3, and "The start screen"): the one way both a Describe to Set Up suggestion and a structure picked on the
// start are created. The pages are written by runSetup; the knowledgebase takes the structure's name while it is
// still untitled, and the first new page opens. Loaded with the dialog or on a pick, never on the editor's first load.
import { truncateName } from '@liveknowledge/document';
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { selectPage } from '@/components/page-tree/select-page';
import type { ImportProgress, ImportWriteResult } from '@/lib/knowledge-import/write-plan';
import { runSetup } from '@/lib/knowledge-setup/run-setup';
import type { ReviewPage } from '@/lib/knowledge-setup/setup-tree';
import { track } from '@/lib/telemetry';

export const UNTITLED_KNOWLEDGEBASE = 'Untitled Knowledgebase';
export const isUntitled = (name: string | null | undefined): boolean =>
  !name?.trim() || name.trim() === UNTITLED_KNOWLEDGEBASE;

export type CreateStructureArgs = {
  chrome: EditorChromeStore;
  documentId: string;
  pages: readonly ReviewPage[];
  /** The knowledgebase's name to take while it has none of its own; null to leave it. */
  name: string | null;
  /** Where it came from, for the one event sent when pages are made. */
  from: 'FromSetup' | 'FromStructure';
  /** The page the structure lands under (Describe to Add Pages); absent for the top level. */
  parent?: string | undefined;
  /** The untouched only page, which the structure's first page takes the place of. */
  replaceId?: string | undefined;
  cancelled: () => boolean;
  onProgress: (progress: ImportProgress) => void;
};

export async function createStructure(args: CreateStructureArgs): Promise<ImportWriteResult> {
  const { chrome } = args;
  const made = await runSetup({
    pages: args.pages,
    host: {
      documentId: args.documentId,
      getTabs: () => chrome.get().tabs,
      getActiveTab: () => chrome.get().activeTab,
      commitTabs: (mapTabs) => chrome.get().commitTabs(mapTabs),
      markTabLoaded: (id) => chrome.get().markTabLoaded(id),
    },
    parent: args.parent,
    replaceId: args.replaceId,
    cancelled: args.cancelled,
    onProgress: args.onProgress,
  });
  if (made.imported > 0) {
    track('Tab', 'Created', args.from);
    const named = args.name?.trim();
    if (named && isUntitled(chrome.get().documentName))
      chrome.get().nameDocument(truncateName(named));
    if (made.first) selectPage(chrome.get(), made.first.id);
  }
  return made;
}
