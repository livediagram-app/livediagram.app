import { InfoNote } from '@/components/primitives/InfoNote';

import type { SelectedNode } from './views';

// A view whose rows are gathered by the app rather than filed by the reader explains itself in an
// info block under its breadcrumb, so an empty one doesn't read as a bare, confusing page. Today
// that is This browser (docs/specs/006-document/offline-mode.md).
const VIEW_INFO: Partial<Record<SelectedNode['kind'], string>> = {
  offline:
    'Documents saved only in this browser collect here automatically. They are not synced or backed up; use Sync Document on a row to move one to your account.',
};

export function ViewInfo({ selected }: { selected: SelectedNode }) {
  const text = VIEW_INFO[selected.kind];
  if (!text) return null;
  return <InfoNote className="mb-3">{text}</InfoNote>;
}
