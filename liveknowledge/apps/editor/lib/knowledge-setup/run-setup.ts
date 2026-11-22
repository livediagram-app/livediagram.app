// Describe to Set Up's third step, run in the browser (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// flow"): the ticked pages written through the Import write path (lib/knowledge-import/write-plan.ts), twenty at a
// time, into the open knowledgebase through its own page list and autosave. Each batch is one edit, so one undo
// step. The knowledgebase's untouched only page becomes the structure's first page; nothing else there is changed.
// Loaded with the dialog, so none of it is in the editor's first bundle.
import { pageDepth, type Tab } from '@liveknowledge/document';
import { whenTabSaved } from '@liveworkspace/workbench/lib/tab-saved';
import { markArticleSettle } from '@/lib/article/article-grow-store';
import { openKnowledgebaseLayer } from '@/lib/knowledge-import/save-layers';
import {
  writeImportPlan,
  type ImportProgress,
  type ImportSaveLayer,
  type ImportWriteResult,
} from '@/lib/knowledge-import/write-plan';
import { newTabSeed } from '@/lib/new-tab-seed';
import { setupPlan, withRoomUnderHeadings } from './setup-plan';
import { tickedPages, type ReviewPage } from './setup-tree';

/** What the run needs of the open editor: the page list's own reads and writes. */
export type SetupHost = {
  documentId: string;
  getTabs: () => Tab[];
  getActiveTab: () => Tab | undefined;
  commitTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  markTabLoaded: (id: string) => void;
};

export type RunSetupArgs = {
  pages: readonly ReviewPage[];
  host: SetupHost;
  /** The page the structure lands under (Describe to Add Pages); absent for the top level. */
  parent?: string | undefined;
  /** The untouched only page, which the structure's first page takes the place of. */
  replaceId?: string | undefined;
  cancelled: () => boolean;
  onProgress: (progress: ImportProgress) => void;
  /** Test seams: the autosave's answer and fresh ids. */
  whenSaved?: typeof whenTabSaved;
  newId?: () => string;
};

/** How deep the page a structure lands under sits: 0 for the top level (or a page that has gone). */
export const landingDepth = (tabs: readonly Tab[], parent: string | undefined): number =>
  parent === undefined ? 0 : pageDepth(tabs, parent);

export async function runSetup(args: RunSetupArgs): Promise<ImportWriteResult> {
  const { host, replaceId } = args;
  const plan = setupPlan(tickedPages(args.pages));
  const layer = openKnowledgebaseLayer({
    documentId: host.documentId,
    getTabs: host.getTabs,
    commitTabs: host.commitTabs,
    markTabLoaded: host.markTabLoaded,
    markArticleSettle,
    whenSaved: args.whenSaved ?? whenTabSaved,
    ...(replaceId !== undefined ? { replaceId } : {}),
  });
  // Each page gets room to write under its headings before it is stored.
  const save: ImportSaveLayer = {
    writeBatch: (pages, flow) => layer.writeBatch(pages.map(withRoomUnderHeadings), flow),
  };
  // The first page takes the untouched page's id, so the write path makes it in that page's place.
  let takeFirst = replaceId;
  const fresh = args.newId ?? (() => crypto.randomUUID());
  return writeImportPlan(plan, {
    save,
    // A structure has no pictures.
    storePicture: async () => ({ ok: false, failure: 'missing-bytes' }),
    newId: () => {
      const id = takeFirst ?? fresh();
      takeFirst = undefined;
      return id;
    },
    ...(args.parent !== undefined ? { parent: args.parent } : {}),
    seed: newTabSeed(host.getActiveTab()),
    cancelled: args.cancelled,
    onProgress: args.onProgress,
  });
}
