'use client';

// The Tags page's body (docs/specs/013-workspace/tags.md "The Tags page"): one section per tag, alphabetical, each its
// heading (the chip, the count, the tag's menu) over its designs in the view the toggle picked; or one tag's
// designs. A design with two tags shows under both: that is the grouping.

import { useEffect, useId, type ReactNode } from 'react';
import { Button, EmptyState } from '@livedesign/ui';
import type { Tag } from '@livedesign/api-schema';
import { PlusIcon, TagIcon } from '@/components/primitives/explorer-icons';
import { useDesignTags } from '@/components/tags/DesignTagsProvider';
import { useTagActionsMenu } from '@/components/tags/TagActionsMenu';
import { TagChip } from '@/components/tags/TagChip';
import { designCountLabel } from '@/components/tags/tag-copy';
import { LoadFailed } from '../lens/LensStates';
import { SkeletonRows, type PaneDesign } from '../views';

const TAGS_EMPTY_TITLE = 'Group related designs with tags';
const TAGS_EMPTY_DESCRIPTION =
  "Make a tag here, or choose Tags in any design's menu. Your tags are yours alone: nobody else sees them.";

type Props = {
  // Every design the reader's tags can sit on (their own and their teams'), newest first.
  designs: readonly PaneDesign[];
  // One tag's page, or every tag's sections.
  tagId: string | undefined;
  onOpenTag: (tagId: string | null) => void;
  onNewTag: () => void;
  // The designs in the view the toggle picked, with the rows and menus every Explorer list has.
  renderDesigns: (designs: PaneDesign[]) => ReactNode;
};

export function TagsPane({ designs, tagId, onOpenTag, onNewTag, renderDesigns }: Props) {
  const { status, tags, tagById, designsFor, reload } = useDesignTags();
  const tag = tagId ? tagById.get(tagId) : undefined;
  // A tag that is not the reader's (deleted since, or someone else's link) opens the Tags page.
  const missing = tagId !== undefined && status === 'ready' && !tag;
  useEffect(() => {
    if (missing) onOpenTag(null);
  }, [missing, onOpenTag]);

  const docsOf = (id: string) => {
    const ids = designsFor(id);
    return ids.size === 0 ? [] : designs.filter((d) => ids.has(d.id));
  };

  if (status === 'error') return <LoadFailed onRetry={() => void reload()} />;
  if (status !== 'ready') return <SkeletonRows />;
  if (tag) {
    const docs = docsOf(tag.id);
    return docs.length > 0 ? (
      <>{renderDesigns(docs)}</>
    ) : (
      <EmptyState
        icon={<TagIcon />}
        title={`Nothing tagged ${tag.name} yet`}
        description="Choose Tags in a design's menu to add this tag to it."
      />
    );
  }
  if (tags.length === 0) {
    return (
      <EmptyState icon={<TagIcon />} title={TAGS_EMPTY_TITLE} description={TAGS_EMPTY_DESCRIPTION}>
        <Button onClick={onNewTag}>
          <PlusIcon size={14} />
          New Tag
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {tags.map((t) => (
        <TagSection
          key={t.id}
          tag={t}
          designs={docsOf(t.id)}
          onOpen={() => onOpenTag(t.id)}
          renderDesigns={renderDesigns}
        />
      ))}
    </div>
  );
}

function TagSection({
  tag,
  designs,
  onOpen,
  renderDesigns,
}: {
  tag: Tag;
  designs: PaneDesign[];
  onOpen: () => void;
  renderDesigns: Props['renderDesigns'];
}) {
  const headingId = useId();
  const menu = useTagActionsMenu(tag);
  return (
    <section aria-labelledby={headingId} data-tag-section={tag.id}>
      <div className="group mb-2.5 flex items-center gap-2.5" onContextMenu={menu.onContextMenu}>
        <h2 id={headingId} className="min-w-0">
          <TagChip tag={tag} size="md" onOpen={onOpen} />
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {designCountLabel(designs.length)}
        </span>
        <span className="flex-1" />
        {menu.trigger}
        {menu.layers}
      </div>
      {designs.length > 0 ? (
        renderDesigns(designs)
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nothing tagged yet. Choose Tags in a design&rsquo;s menu to add some.
        </p>
      )}
    </section>
  );
}
