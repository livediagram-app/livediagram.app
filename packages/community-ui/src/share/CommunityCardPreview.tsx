'use client';

import { useState } from 'react';
import type { CommunityAuthor, CommunityCategory, CommunityPost } from '@liveworkspace/community';
import { CommunityCopyCount, CommunityLikeCount } from '../tile/CommunityCounts';
import { CommunityPostTile } from '../tile/CommunityPostTile';
import { useCommunityShareHost } from './host';

// How the post's card will look in the Community gallery (docs/specs/025-community/community.md
// "Publishing", "Gallery"): the gallery's own card, still (no link, no lift), so the preview is the card. The image
// is the document's own snapshot through the owner's authenticated read (the public card image only exists once
// the post does), and it degrades to the undrawn sketch when there is none. Before a category is chosen its label
// asks for one.
export function CommunityCardPreview({
  title,
  category,
  tags,
  author,
  likeCount = 0,
  copyCount = 0,
}: {
  title: string;
  category: CommunityCategory | null;
  tags: string[];
  author: CommunityAuthor;
  likeCount?: number;
  copyCount?: number;
}) {
  // One snapshot version, and one "now", for the dialog's life: a fresh read when it opens, then a stable image
  // (and "just now") while the person types.
  const { thumbnail } = useCommunityShareHost();
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
        image={thumbnail}
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
