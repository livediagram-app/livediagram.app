import { InfoNote } from '@/components/primitives/InfoNote';

import type { SelectedNode } from './views';

// "Dynamic" (synthetic) folders aren't real folder rows — they're a live
// view over diagrams that share some property (Unsorted = no folder).
// Because the user never created them, an info block under the breadcrumb
// explains why the folder exists and what lands in it, so an empty one
// doesn't just read as a bare, confusing page. Add an entry here when a
// new dynamic folder is introduced (e.g. Generated).
const DYNAMIC_FOLDER_INFO: Partial<Record<SelectedNode['kind'], string>> = {
  unsorted:
    'Unsorted is an automatically generated folder, diagrams you haven’t filed into a folder show up here.',
  generated: 'Diagrams created by a connected AI tool collect here automatically.',
  dynamic:
    'Dynamic folders are automatically generated views over your diagrams. Unsorted, Generated, and Offline collect diagrams by state, so nothing gets lost.',
  offline:
    'Diagrams saved only in this browser collect here automatically. They are not synced or backed up; use Sync Diagram on a row to move one to your account.',
};

export function DynamicFolderInfo({ selected }: { selected: SelectedNode }) {
  const text = DYNAMIC_FOLDER_INFO[selected.kind];
  if (!text) return null;
  return <InfoNote className="mb-3">{text}</InfoNote>;
}
