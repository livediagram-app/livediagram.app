// Building blocks for the sync planner's suites: a document's overview and envelope as the api answers them, a
// tracked mirror file of it, and coverage.

import type { OverviewView } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { Coverage, CoveredDocument } from '../link/coverage';
import type { MirrorFile } from '../link/mirror-file';
import type { ScannedFile, TabHashes } from '../link/mirror-scan';
import type { RemoteFact } from '../link/remote';
import { tabHashes } from '../sync/pull-file';

export type FixtureDoc = {
  id: string;
  name: string;
  tabs: { id: string; name: string; rev: number }[];
};

export const fixtureDoc = (id: string, name: string, revs: number[] = [1]): FixtureDoc => ({
  id,
  name,
  tabs: revs.map((rev, i) => ({ id: `${id}-t${i + 1}`, name: `Tab ${i + 1}`, rev })),
});

export function readableFact(doc: FixtureDoc): RemoteFact {
  const overview: OverviewView = {
    document: { id: doc.id, name: doc.name, savedAt: 0, tabs: doc.tabs.length },
    tabs: doc.tabs.map((t) => ({
      view: 'overview',
      outOfScope: false,
      tab: { id: t.id, ref: t.id, name: t.name, kind: 'diagram' },
      elements: 1,
      counts: { boxes: 1, frames: 0, lanes: 0, arrows: 0 },
      hidden: 0,
      unknown: 0,
      threads: { open: 0, total: 0 },
      rev: t.rev,
    })),
    elision: null,
  };
  return {
    kind: 'readable',
    overview,
    envelope: {
      name: doc.name,
      presentation: null,
      tabs: doc.tabs.map((t, orderIndex) => ({ id: t.id, orderIndex })),
    },
  };
}

const tabOf = (t: FixtureDoc['tabs'][number]): Tab => ({ id: t.id, name: t.name, elements: [] });

// A tracked mirror file of the document as it is now; `edited` changes its first tab's elements.
export async function trackedFile(
  doc: FixtureDoc,
  path: string,
  edited = false,
): Promise<Extract<ScannedFile, { class: 'tracked' }>> {
  const tabs = doc.tabs.map(tabOf);
  const hashes: TabHashes = {};
  const recorded: MirrorFile['livediagramSync']['tabs'] = {};
  for (const [i, t] of doc.tabs.entries()) {
    hashes[t.id] = await tabHashes(tabs[i]!);
    recorded[t.id] = { rev: t.rev, ...hashes[t.id]! };
  }
  if (edited) hashes[doc.tabs[0]!.id] = { ...hashes[doc.tabs[0]!.id]!, hash: 'edited' };
  return {
    class: 'tracked',
    path,
    file: {
      kind: 'livediagram.document',
      schemaVersion: 1,
      document: { id: doc.id, name: doc.name, presentation: null, tabs },
      livediagramSync: { host: 'https://livediagram.app', tabs: recorded },
    },
    hashes,
  };
}

export function coverageOf(
  docs: (FixtureDoc & { folderPath?: string[] })[],
  folder: Coverage['folder'] = { id: 'f1', found: true },
): Coverage {
  const documents: CoveredDocument[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    folderPath: d.folderPath ?? [],
    indexFolder: 'My documents/Games',
    library: 'personal',
    savedAt: 0,
  }));
  return { folder, documents, reachable: docs.map((d) => d.id) };
}
