'use client';

import { useState, type ReactNode } from 'react';
import type { CommunityStartPost } from '@liveworkspace/community';
import { communityViewerPath } from '@liveworkspace/community/paths';
import type { CommunityStartPosts } from './start-client';

// Start With's Community tiles as a template picker's cards (liveworkspace/docs/specs/007-community/community.md "Start
// With"). Each product's picker draws its own cards (StartCard), so this gives it what a card needs, in the shape every
// product's StartPanelCard already takes: the post's live card image as the picture, its title and line, and the
// **Community** badge in the badge slot beside the name, where a template has none. Choosing one makes the person's
// own copy through the post's community link (`communityStartHref`), the gallery's Make a Copy, so it counts as a copy.

/** The badge every Community tile wears. */
export const COMMUNITY_START_BADGE = 'Community';

// A Community tile's card id, kept apart from template kinds (which never hold a colon).
const CARD_PREFIX = 'community:';

export const communityStartCardId = (postId: string): string => `${CARD_PREFIX}${postId}`;

/** The post a card id names, or null for a template's card. */
export function communityStartPostId(cardId: string): string | null {
  return cardId.startsWith(CARD_PREFIX) ? cardId.slice(CARD_PREFIX.length) || null : null;
}

/** Where choosing a tile goes: the viewer on the post's own app, copying it into the person's own documents. */
export const communityStartHref = (post: Pick<CommunityStartPost, 'app' | 'shareCode'>): string =>
  communityViewerPath(post.app, post.shareCode, true);

/** Who made it, for the card's note: their name, or that they shared it anonymously. */
export const communityStartCredit = (post: Pick<CommunityStartPost, 'anonymous' | 'authorName'>) =>
  post.anonymous ? 'Shared anonymously' : `By ${post.authorName}`;

/** A card, in the shape a product's StartPanelCard takes (its `note` is the product's to draw, in its own colours). */
export type CommunityStartCard = {
  id: string;
  name: string;
  line: string;
  picture: ReactNode;
  badge: string;
  // What a screen reader hears after the name: "Sprint Retro from the Community: …".
  ariaKind: string;
};

/**
 * The post's live card image, letterboxed on the same light plate a template's preview sits on, so the two read as
 * one set. It loads lazily and decodes off the main thread; the plate holds its box from the first frame, so the
 * image arriving (or failing, when it is simply left out) moves nothing.
 */
export function CommunityStartPicture({
  src,
  className = 'rounded-lg bg-slate-50',
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
      {failed ? null : (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      )}
    </span>
  );
}

export function communityStartCard(
  post: CommunityStartPost,
  {
    imageUrl,
    pictureClassName,
  }: { imageUrl: (shareCode: string) => string; pictureClassName?: string },
): CommunityStartCard {
  return {
    id: communityStartCardId(post.id),
    name: post.title,
    line: post.line,
    picture: <CommunityStartPicture src={imageUrl(post.shareCode)} className={pictureClassName} />,
    badge: COMMUNITY_START_BADGE,
    ariaKind: 'from the Community',
  };
}

/** A category's tiles, best first (none for a category the answer leaves out, or a malformed one). */
export function communityStartPostsIn(posts: CommunityStartPosts, category: string) {
  const list = (posts as Record<string, unknown>)[category];
  return Array.isArray(list) ? (list as CommunityStartPost[]) : [];
}

/** The post a card id names, in any category. */
export function findCommunityStartPost(
  posts: CommunityStartPosts,
  cardId: string,
): CommunityStartPost | null {
  const id = communityStartPostId(cardId);
  if (!id) return null;
  for (const list of Object.values(posts)) {
    const found = Array.isArray(list) ? list.find((p) => p.id === id) : undefined;
    if (found) return found;
  }
  return null;
}

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Whether a tile's title holds every word searched for (as a template's name would; case and punctuation ignored). */
export function communityStartMatches(
  post: Pick<CommunityStartPost, 'title'>,
  query: string,
): boolean {
  const asked = words(query);
  if (asked.length === 0) return false;
  const title = words(post.title).join(' ');
  return asked.every((w) => title.includes(w));
}
