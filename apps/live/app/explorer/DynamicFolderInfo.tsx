import { InfoNote } from '@/components/primitives/InfoNote';

import type { SelectedNode } from './views';

// "Dynamic" (synthetic) folders aren't real folder rows — they're a live
// view over documents that share some property (Unsorted = no folder).
// Because the user never created them, an info block under the breadcrumb
// explains why the folder exists and what lands in it, so an empty one
// doesn't just read as a bare, confusing page. Add an entry here when a
// new dynamic folder is introduced (e.g. Generated).
const DYNAMIC_FOLDER_INFO: Partial<Record<SelectedNode['kind'], string>> = {
  unsorted:
    'Unsorted is an automatically generated folder, documents you haven’t filed into a folder show up here.',
  generated: 'Documents created by a connected AI tool collect here automatically.',
  dynamic:
    'Dynamic folders are automatically generated views over your documents. Unsorted, Generated, and Offline collect documents by state, so nothing gets lost.',
  offline:
    'Documents saved only in this browser collect here automatically. They are not synced or backed up; use Sync Document on a row to move one to your account.',
};

export function DynamicFolderInfo({ selected }: { selected: SelectedNode }) {
  const text = DYNAMIC_FOLDER_INFO[selected.kind];
  if (!text) return null;
  return <InfoNote className="mb-3">{text}</InfoNote>;
}
