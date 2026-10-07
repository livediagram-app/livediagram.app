// INDEX.md's entries for a pass (docs/specs/027-repositories/blueprints/repository-link.md "`INDEX.md`"): each
// covered document as the pass left it. A document written or in step gets a fresh section, from its mirror file
// at `files` and from the overview at `index`; a gone one none; any other (refused, unreadable, transient, or not
// acted on by a narrowed pass) keeps its previous section (RL16).

import type { Tab } from '@livediagram/document';
import { headerFactsOf, headerLine } from '@livediagram/document-views';
import type { Coverage } from './coverage';
import type { IndexEntry, IndexTab } from './index-file';
import type { MirrorLevel } from './link-file';
import { outlinePathOf } from './mirror-paths';
import { remoteTabsOf, type RemoteFact } from './remote';
import type { SyncState } from './sync-state';

// What a document's mirror file holds after the pass, and where.
export type MirrorHeld = { path: string; tabs: readonly Tab[]; revs: Record<string, number> };

export type PassOutcome = {
  level: MirrorLevel;
  coverage: Coverage;
  states: ReadonlyMap<string, SyncState | 'transient'>;
  remote: ReadonlyMap<string, RemoteFact>;
  // At `files`: each document's file, when it was written or found in step.
  mirrors: ReadonlyMap<string, MirrorHeld>;
  // On a dry run at `files`: the path each document's mirror file would hold; its tabs come from the overview.
  planned: ReadonlyMap<string, string>;
  // The names of the documents the pass decided, covered or not.
  names: ReadonlyMap<string, string>;
};

function tabsOfFile({ tabs, revs }: MirrorHeld): IndexTab[] {
  const tabIds = tabs.map((t) => t.id);
  return tabs.map((tab) => {
    const facts = headerFactsOf(tab, { rev: revs[tab.id], tabIds });
    return {
      name: tab.name,
      kind: facts.tab.kind,
      elements: facts.elements,
      rev: revs[tab.id]!,
      header: null,
    };
  });
}

export function indexEntriesOf(outcome: PassOutcome): IndexEntry[] {
  const { level, coverage, states, remote, mirrors, names, planned } = outcome;
  // A document out of sight this pass (unreadable, or failing) keeps its section though coverage no longer lists it.
  const unseen = [...states.keys()]
    .filter((id) => !coverage.documents.some((d) => d.id === id))
    .map((id) => ({
      id,
      name: names.get(id)!,
      folderPath: [],
      indexFolder: '',
      library: '',
      savedAt: null,
    }));
  return [...coverage.documents, ...unseen].flatMap((covered): IndexEntry[] => {
    const state = states.get(covered.id);
    if (state === 'gone') return [];
    const fact = remote.get(covered.id);
    const readable = fact?.kind === 'readable' ? fact : null;
    const name = readable?.overview.document.name ?? covered.name ?? covered.id;
    const entry = { id: covered.id, name, folderPath: covered.folderPath };
    const fresh = state === 'in-step' || state === 'new' || state === 'behind';
    const mirror = mirrors.get(covered.id);
    const at = mirror?.path ?? planned.get(covered.id) ?? null;
    if (!fresh || !readable || (level === 'files' && at === null))
      return [{ ...entry, section: null }];
    const section = mirror
      ? {
          indexFolder: covered.indexFolder,
          files: { mirror: mirror.path, outline: outlinePathOf(mirror.path) },
          tabs: tabsOfFile(mirror),
        }
      : {
          indexFolder: covered.indexFolder,
          files: at === null ? null : { mirror: at, outline: outlinePathOf(at) },
          tabs: remoteTabsOf(readable.overview).map((f) => ({
            name: f.tab.name,
            kind: f.tab.kind,
            elements: f.elements,
            rev: f.rev!,
            header: at === null ? headerLine(f) : null,
          })),
        };
    return [{ ...entry, section }];
  });
}
