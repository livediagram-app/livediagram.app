'use client';

// The editor's Explorer pane on Tags (docs/specs/013-workspace/tags.md "The editor's Explorer panel"): each tag a
// heading (its chip and count) over its designs as the pane's rows, alphabetical; the compact empty state when the
// reader has no tags. Managing tags is the Explorer page's (Open Page).

import type { PaneDesign } from '@/app/explorer/views';
import { TagIcon } from '@/components/primitives/explorer-icons';
import { useDesignTags } from '@/components/tags/DesignTagsProvider';
import { TagChip } from '@/components/tags/TagChip';
import { designCountLabel } from '@/components/tags/tag-copy';
import { PaneEmpty, PaneFailed, PaneList, PaneSkeleton } from '../explorer-panel/pane-parts';
import { PanelDesignItem } from './PanelDesignItem';

export function PanelTagsSection({ designs }: { designs: readonly PaneDesign[] }) {
  const { status, tags, designsFor, reload } = useDesignTags();
  if (status === 'error') {
    return <PaneFailed message="Couldn't load your tags." onRetry={() => void reload()} />;
  }
  if (status !== 'ready') return <PaneSkeleton />;
  if (tags.length === 0) {
    return (
      <PaneEmpty
        icon={<TagIcon />}
        title="No tags yet"
        description="Choose Tags in a design's menu to group related designs."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {tags.map((tag) => {
        const ids = designsFor(tag.id);
        const docs = ids.size ? designs.filter((d) => ids.has(d.id)) : [];
        return (
          <section key={tag.id} aria-label={tag.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2">
              <TagChip tag={tag} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {designCountLabel(docs.length)}
              </span>
            </div>
            {docs.length ? (
              <PaneList label={tag.name}>
                {docs.map((d) => (
                  <PanelDesignItem key={d.id} design={d} />
                ))}
              </PaneList>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
