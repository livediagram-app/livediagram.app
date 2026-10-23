'use client';

// The editor's Explorer pane on Tags (docs/specs/013-workspace/tags.md "The editor's Explorer panel"): each tag a
// heading (its chip and count) over its projects as the pane's rows, alphabetical; the compact empty state when the
// reader has no tags. Managing tags is the Explorer page's (Open Page).

import type { PaneProject } from '@/app/explorer/views';
import { TagIcon } from '@/components/primitives/explorer-icons';
import { useProjectTags } from '@/components/tags/ProjectTagsProvider';
import { TagChip } from '@/components/tags/TagChip';
import { projectCountLabel } from '@/components/tags/tag-copy';
import { PaneEmpty, PaneFailed, PaneList, PaneSkeleton } from '../explorer-panel/pane-parts';
import { PanelProjectItem } from './PanelProjectItem';

export function PanelTagsSection({ projects }: { projects: readonly PaneProject[] }) {
  const { status, tags, projectsFor, reload } = useProjectTags();
  if (status === 'error') {
    return <PaneFailed message="Couldn't load your tags." onRetry={() => void reload()} />;
  }
  if (status !== 'ready') return <PaneSkeleton />;
  if (tags.length === 0) {
    return (
      <PaneEmpty
        icon={<TagIcon />}
        title="No tags yet"
        description="Choose Tags in a plan's menu to group related plans."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {tags.map((tag) => {
        const ids = projectsFor(tag.id);
        const docs = ids.size ? projects.filter((d) => ids.has(d.id)) : [];
        return (
          <section key={tag.id} aria-label={tag.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-2">
              <TagChip tag={tag} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {projectCountLabel(docs.length)}
              </span>
            </div>
            {docs.length ? (
              <PaneList label={tag.name}>
                {docs.map((d) => (
                  <PanelProjectItem key={d.id} project={d} />
                ))}
              </PaneList>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
