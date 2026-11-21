// Where an import's pages are stored (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Save layers").
// Under a page of the open knowledgebase, a batch is one edit of the editor's own page list, saved by the autosave
// like any page a person adds, and the next batch waits until that one is stored. Into a new knowledgebase, the
// first batch creates it and the rest are saved to it, parents before their subpages. Both answer the pages that
// could not be stored, each with why.

import { withPageAdded, type Tab } from '@liveknowledge/document';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import type { BatchResult, ImportSaveLayer } from './write-plan';

/** How long a batch waits for the autosave to store it before the import stops (what was added keeps saving). */
export const IMPORT_SAVE_WAIT_MS = 60_000;
/** Pages of a new knowledgebase saved at once. */
export const IMPORT_SAVE_CONCURRENCY = 4;

export type OpenKnowledgebaseDeps = {
  documentId: string;
  /** The knowledgebase's pages as the editor holds them now. */
  getTabs(): Tab[];
  commitTabs(mapTabs: (tabs: Tab[]) => Tab[]): void;
  /** A page made here has no stored copy to load. */
  markTabLoaded(id: string): void;
  /** The importer is the writer of what came in: this editor lays each page's writing out when it is opened. */
  markArticleSettle(tabId: string, flow: string): void;
  /** Resolves true once the autosave has stored the page, false when `timeoutMs` passes first. */
  whenSaved(documentId: string, tabId: string, timeoutMs: number): Promise<boolean>;
  saveWaitMs?: number;
  /** A page already in the knowledgebase that a written page of the same id takes the place of, in the same edit
   *  as its batch (Describe to Set Up: the untouched first page becomes the structure's first). It keeps its place
   *  in the tree. */
  replaceId?: string;
};

// The list with each page added under its parent, and the pages the tree refused, each with why.
function addPages(tabs: Tab[], pages: readonly Tab[]) {
  let list = tabs;
  const added: Tab[] = [];
  const refused = new Map<string, string>();
  for (const page of pages) {
    const next = withPageAdded(list, page, page.parent);
    if (Array.isArray(next)) {
      list = next;
      added.push(page);
    } else refused.set(page.id, pageTreeRefusalText(next.refused));
  }
  return { list, added, refused };
}

/** Pages added to the open knowledgebase through the editor's own state and autosave. */
export function openKnowledgebaseLayer(deps: OpenKnowledgebaseDeps): ImportSaveLayer {
  return {
    async writeBatch(pages, flow): Promise<BatchResult> {
      // The page that takes an existing page's place, when this batch holds it and the page is still there.
      const replacement =
        deps.replaceId !== undefined && deps.getTabs().some((t) => t.id === deps.replaceId)
          ? pages.find((page) => page.id === deps.replaceId)
          : undefined;
      const fresh = replacement ? pages.filter((page) => page !== replacement) : pages;
      // What the tree takes, judged against the pages as they are now (the limits are the tree's own, and the room
      // checks them again).
      const { added, refused } = addPages(deps.getTabs(), fresh);
      const written = replacement ? [replacement, ...added] : added;
      if (written.length === 0) return { failed: refused };
      for (const page of written) {
        deps.markTabLoaded(page.id);
        deps.markArticleSettle(page.id, flow);
      }
      // One edit for the batch; made again over the list the edit lands on, which a peer may have changed.
      deps.commitTabs((tabs) => {
        const swapped = replacement
          ? tabs.map((tab) => {
              if (tab.id !== replacement.id) return tab;
              // Where the page sits is the tree's, not the new writing's, and so is who owns it (its creator, from
              // the create: verification.md "The owner").
              const { parent: _parent, ...rest } = replacement;
              void _parent;
              const kept = tab.knowledge ? { ...rest, knowledge: tab.knowledge } : rest;
              return tab.parent ? { ...kept, parent: tab.parent } : kept;
            })
          : tabs;
        return addPages(swapped, added).list;
      });
      const saved = await Promise.all(
        written.map((page) =>
          deps.whenSaved(deps.documentId, page.id, deps.saveWaitMs ?? IMPORT_SAVE_WAIT_MS),
        ),
      );
      return saved.every(Boolean) ? { failed: refused } : { failed: refused, stalled: true };
    },
  };
}

export type NewKnowledgebaseDeps = {
  /** Makes the knowledgebase with its first pages. */
  create(pages: Tab[]): Promise<void>;
  /** Saves one page to it. */
  saveTab(page: Tab): Promise<void>;
  /** Writes the page list's order and parents. */
  saveOrder(pages: { id: string; parent: string | null }[]): Promise<void>;
};

/** Pages written to a knowledgebase this import makes: created with the first batch, then saved to. */
export function newKnowledgebaseLayer(deps: NewKnowledgebaseDeps): ImportSaveLayer {
  let created = false;
  // Every page stored so far, in tree order.
  const order: { id: string; parent: string | null }[] = [];
  const note = (page: Tab) => order.push({ id: page.id, parent: page.parent ?? null });
  return {
    async writeBatch(pages): Promise<BatchResult> {
      if (!created) {
        await deps.create(pages);
        created = true;
        pages.forEach(note);
        return { failed: new Map() };
      }
      const failed = new Map<string, string>();
      const stored = new Set<string>();
      // Waves: a page is saved once the page it sits under is no longer waiting in this batch.
      let waiting = pages;
      while (waiting.length > 0) {
        const held = new Set(waiting.map((p) => p.id));
        const wave = waiting.filter((p) => !p.parent || !held.has(p.parent));
        // Never reached by a tree: pages that only sit under each other are left out rather than waited on.
        if (wave.length === 0) {
          for (const page of waiting) failed.set(page.id, 'It could not be saved.');
          break;
        }
        const ready = wave.filter((page) => {
          if (!page.parent || !failed.has(page.parent)) return true;
          failed.set(page.id, 'The page it sits under could not be saved.');
          return false;
        });
        let next = 0;
        const worker = async () => {
          while (next < ready.length) {
            const page = ready[next++]!;
            try {
              await deps.saveTab(page);
              stored.add(page.id);
            } catch {
              failed.set(page.id, 'It could not be saved.');
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(IMPORT_SAVE_CONCURRENCY, ready.length) }, worker),
        );
        const done = new Set(wave.map((p) => p.id));
        waiting = waiting.filter((p) => !done.has(p.id));
      }
      for (const page of pages) if (stored.has(page.id)) note(page);
      // Nothing of the batch stored: the connection, or the knowledgebase, is gone.
      if (stored.size === 0) return { failed, stalled: true };
      try {
        await deps.saveOrder(order);
      } catch {
        // The pages are stored; their order is written again with the next batch, which this one does not start.
        return { failed, stalled: true };
      }
      return { failed };
    },
  };
}
