'use client';

// The editor's Explorer pane on Tags (docs/specs/013-workspace/tags.md "The editor's Explorer panel"): each tag a
// heading (its chip and count) over its documents as the pane's rows, alphabetical; the compact empty state when the
// reader has no tags. Managing tags is the Explorer page's (Open Page).

import type { PaneDocument } from '@/app/explorer/views';
import { TagIcon } from '@/components/primitives/explorer-icons';
import { useDocumentTags } from '@/components/tags/DocumentTagsProvider';
import { TagChip } from '@/components/tags/TagChip';
import { documentCountLabel } from '@/app/explorer/tags/TagsPane';
import { PaneEmpty, PaneFailed, PaneList, PaneSkeleton } from '../explorer-panel/pane-parts';
import { PanelDocumentItem } from './PanelDocumentItem';

export function PanelTagsSection({ documents }: { documents: readonly PaneDocument[] }) {
  const { status, tags, documentsFor, reload } = useDocumentTags();
  if (status === 'error') {
    return <PaneFailed message="Couldn't load your tags." onRetry={() => void reload()} />;
  }
  if (status !== 'ready') return <PaneSkeleton />;
  if (tags.length === 0) {
    return (
      <PaneEmpty
        icon={<TagIcon />}
        title="No tags yet"
        description="Choose Tags in a document's menu to group related documents."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {tags.map((tag) => {
        const ids = documentsFor(tag.id);
        const docs = ids.size ? documents.filter((d) => ids.has(d.id)) : [];
        return (
          <section key={tag.id} aria-label={tag.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2">
              <TagChip tag={tag} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {documentCountLabel(docs.length)}
              </span>
            </div>
            {docs.length ? (
              <PaneList label={tag.name}>
                {docs.map((d) => (
                  <PanelDocumentItem key={d.id} document={d} />
                ))}
              </PaneList>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
