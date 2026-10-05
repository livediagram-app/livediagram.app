'use client';

import { useState } from 'react';
import type { CommunityAuthor, CommunityCategory, CommunityPost } from '@livediagram/api-schema';
import { CommunityCopyCount, CommunityLikeCount, CommunityPostTile } from '@livediagram/ui';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';

// How the post's card will look in the Community gallery (docs/specs/025-community/community.md
// "Publishing", "Gallery"): the gallery's own card, still (no link, no lift), so the preview is the card. The image
// is the document's own snapshot through the owner's authenticated read (the public card image only exists once
// the post does), and it degrades to the undrawn sketch when there is none. Before a category is chosen its label
// asks for one.
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
  // One snapshot version, and one "now", for the dialog's life: a fresh read when it opens, then a stable image
  // (and "just now") while the person types.
  const [version] = useState(() => Date.now());
  const post: CommunityPost = {
    id: 'preview',
    title: title.trim() || 'Your title',
    description: '',
    category: category ?? 'other',
    tags,
    likeCount,
    copyCount,
    publishedAt: version,
    updatedAt: version,
    shareCode: '',
    author,
    anonymous: false,
    liked: false,
  };
  return (
    <div aria-label="Card preview" role="group" className="flex">
      <CommunityPostTile
        post={post}
        now={version}
        categoryLabel={category ? undefined : 'Choose a Category'}
        image={
          <DocumentThumbnail
            ownerId={ownerId}
            documentId={documentId}
            version={version}
            className="absolute inset-0 block h-full w-full object-contain p-5"
          />
        }
        stats={
          <>
            <CommunityLikeCount count={likeCount} />
            <CommunityCopyCount count={copyCount} />
          </>
        }
      />
    </div>
  );
}
