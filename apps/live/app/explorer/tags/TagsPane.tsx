'use client';

// The Tags page's body (docs/specs/013-workspace/tags.md "The Tags page"): one section per tag, alphabetical, each its
// heading (the chip, the count, the tag's menu) over its documents in the view the toggle picked; or one tag's
// documents. A document with two tags shows under both: that is the grouping.

import { useEffect, useId, type ReactNode } from 'react';
import { Button, EmptyState } from '@livediagram/ui';
import type { Tag } from '@livediagram/api-schema';
import { PlusIcon, TagIcon } from '@/components/primitives/explorer-icons';
import { useDocumentTags } from '@/components/tags/DocumentTagsProvider';
import { useTagActionsMenu } from '@/components/tags/TagActionsMenu';
import { TagChip } from '@/components/tags/TagChip';
import { documentCountLabel } from '@/components/tags/tag-copy';
import { LoadFailed } from '../lens/LensStates';
import { SkeletonRows, type PaneDocument } from '../views';

export const TAGS_EMPTY_TITLE = 'Group related documents with tags';
export const TAGS_EMPTY_DESCRIPTION =
  "Make a tag here, or choose Tags in any document's menu. Your tags are yours alone: nobody else sees them.";

type Props = {
  // Every document the reader's tags can sit on (their own and their teams'), newest first.
  documents: readonly PaneDocument[];
  // One tag's page, or every tag's sections.
  tagId: string | undefined;
  onOpenTag: (tagId: string | null) => void;
  onNewTag: () => void;
  // The documents in the view the toggle picked, with the rows and menus every Explorer list has.
  renderDocuments: (documents: PaneDocument[]) => ReactNode;
};

export function TagsPane({ documents, tagId, onOpenTag, onNewTag, renderDocuments }: Props) {
  const { status, tags, tagById, documentsFor, reload } = useDocumentTags();
  const tag = tagId ? tagById.get(tagId) : undefined;
  // A tag that is not the reader's (deleted since, or someone else's link) opens the Tags page.
  const missing = tagId !== undefined && status === 'ready' && !tag;
  useEffect(() => {
    if (missing) onOpenTag(null);
  }, [missing, onOpenTag]);

  const docsOf = (id: string) => {
    const ids = documentsFor(id);
    return ids.size === 0 ? [] : documents.filter((d) => ids.has(d.id));
  };

  if (status === 'error') return <LoadFailed onRetry={() => void reload()} />;
  if (status !== 'ready') return <SkeletonRows />;
  if (tag) {
    const docs = docsOf(tag.id);
    return docs.length > 0 ? (
      <>{renderDocuments(docs)}</>
    ) : (
      <EmptyState
        icon={<TagIcon />}
        title={`Nothing tagged ${tag.name} yet`}
        description="Choose Tags in a document's menu to add this tag to it."
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
          documents={docsOf(t.id)}
          onOpen={() => onOpenTag(t.id)}
          renderDocuments={renderDocuments}
        />
      ))}
    </div>
  );
}

function TagSection({
  tag,
  documents,
  onOpen,
  renderDocuments,
}: {
  tag: Tag;
  documents: PaneDocument[];
  onOpen: () => void;
  renderDocuments: Props['renderDocuments'];
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
          {documentCountLabel(documents.length)}
        </span>
        <span className="flex-1" />
        {menu.trigger}
        {menu.layers}
      </div>
      {documents.length > 0 ? (
        renderDocuments(documents)
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nothing tagged yet. Choose Tags in a document&rsquo;s menu to add some.
        </p>
      )}
    </section>
  );
}
