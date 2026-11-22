'use client';

// Watching in the tree's row menu (docs/specs/030-knowledgebase/watching.md "Where it shows"): the row's page's watch,
// read when the menu opens, as PageWatchRows. Nothing for a guest or a knowledgebase kept Offline.
import { MenuGroupSeparator } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { PageWatchRows } from './PageWatchRows';
import { usePageWatch } from './usePageWatch';

export function PageWatchMenuRows({
  id,
  onClose,
  separated = false,
}: {
  id: string;
  onClose: () => void;
  /** A separator above, where nothing else in the menu drew one. */
  separated?: boolean;
}) {
  const { entry, canWatch, set, hidden } = usePageWatch(id);
  if (hidden || entry.status === 'failed') return null;
  return (
    <>
      {separated ? <MenuGroupSeparator /> : null}
      <PageWatchRows
        watch={entry.watch}
        ready={canWatch}
        onSet={(scope) => {
          onClose();
          set(scope);
        }}
      />
    </>
  );
}
