'use client';

import { useState } from 'react';
import {
  communityCategoryLabel,
  type CommunityAuthor,
  type CommunityCategory,
} from '@livediagram/api-schema';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { CommunityAuthorDisc } from '@/components/primitives/CommunityAuthorDisc';

// How the post's card will look in the Community gallery (docs/specs/025-community/community.md
// "Publishing", "Gallery"): the live image, title, category, up to three tags and the author, with
// the counts the card carries. The image is the document's own snapshot through the owner's
// authenticated read (the public card image only exists once the post does), and it degrades to the
// undrawn sketch when there is none.
export function CommunityCardPreview({
  ownerId,
  documentId,
  title,
  category,
  tags,
  author,
  likeCount = 0,
  copyCount = 0,
}: {
  ownerId: string;
  documentId: string;
  title: string;
  category: CommunityCategory | null;
  tags: string[];
  author: CommunityAuthor;
  likeCount?: number;
  copyCount?: number;
}) {
  // One snapshot version for the dialog's life: a fresh read when it opens, then a stable image while
  // the person types.
  const [version] = useState(() => Date.now());
  return (
    <div
      aria-label="Card preview"
      role="group"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <DocumentThumbnail
        ownerId={ownerId}
        documentId={documentId}
        version={version}
        className="block aspect-[4/3] w-full bg-slate-50 bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] [background-size:12px_12px] dark:bg-slate-950"
      />
      <div className="flex flex-col gap-1.5 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
          {title.trim() || 'Your title'}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {category ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {communityCategoryLabel(category)}
            </span>
          ) : null}
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[11px] text-slate-500 dark:text-slate-400">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex min-w-0 items-center gap-1.5">
            <CommunityAuthorDisc author={author} size={18} />
            <span className="truncate">{author.name}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            <span aria-hidden>♥</span> {likeCount} · {copyCount} copies
          </span>
        </div>
      </div>
    </div>
  );
}
