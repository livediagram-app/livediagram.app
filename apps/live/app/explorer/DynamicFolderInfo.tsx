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
  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-snug text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
      <InfoIcon />
      <span>{text}</span>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      fill="none"
      className="mt-px shrink-0 text-slate-400 dark:text-slate-500"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.2v3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="4.3" r="0.75" fill="currentColor" />
    </svg>
  );
}
