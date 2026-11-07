import type { ReactNode } from 'react';
import type { CommunityStartPost } from '@liveworkspace/community';
import {
  communityStartCard,
  communityStartCredit,
  communityStartMatches,
  communityStartPostsIn,
  type CommunityStartCard,
} from './start-cards';
import type { CommunityStartPosts } from './start-client';

// Start With's Community tiles placed in a template picker's groups and search (liveworkspace/docs/specs/007-community/
// community.md "Start With"): each group's best of the month after its templates, and the ones whose title a search
// finds after that group's matching templates. Every product's picker draws its own card (StartCard), so this is
// generic over that card: it hands back `CommunityStartTile`s, which fit any card type with these fields, beside the
// picker's own cards. A product passes its api's card image, the note it draws under the line, and, where its rail is
// not the Community's categories, which posts each rail group shows.

/** Which posts a rail group shows: by default the category with the group's id. */
export type CommunityStartPostsFor = (
  posts: CommunityStartPosts,
  group: string,
) => readonly CommunityStartPost[];

/** How a product's picker draws its tiles. */
export type CommunityStartTileOptions = {
  /** The post's live card image on the product's api (its `communityImagePath(shareCode)` under its api base). */
  imageUrl: (shareCode: string) => string;
  /** The picture plate's classes, when the product's plate differs from the light one templates sit on. */
  pictureClassName?: string;
  /** What the card shows under its line, in the product's colours (`communityStartCreditNote`); none when left out. */
  note?: (post: CommunityStartPost) => ReactNode;
  /** Which posts each rail group shows (`communityStartPostsInto` folds every category into one group). */
  postsFor?: CommunityStartPostsFor;
};

/** A Community tile as a picker's card: the shared card, with the product's note. */
export type CommunityStartTile = CommunityStartCard & { note?: ReactNode };

/** A search's group of cards, as a picker hands them to its panel (`name` where the rail has no entry to name it). */
export type CommunityStartSearchGroup<Card, C extends string = string> = {
  category: C;
  name?: string;
  cards: readonly Card[];
};

/** The note every product draws under a tile's line: who made it, in the panel's quiet ink. */
export function CommunityStartCreditNote({
  post,
  color,
}: {
  post: CommunityStartPost;
  color: string;
}) {
  return (
    <span className="text-[11.5px] font-medium" style={{ color }}>
      {communityStartCredit(post)}
    </span>
  );
}

/** A `note` renderer drawing the credit in `color` (the panel's muted ink). */
export const communityStartCreditNote =
  (color: string) =>
  (post: CommunityStartPost): ReactNode => <CommunityStartCreditNote post={post} color={color} />;

/**
 * Every category's posts in one rail group (`group`), in `categories`' order, each category's best first; none in any
 * other group. For a picker whose rail is not the Community's categories (liveplanner's Start Planning folds them all
 * into Inspiration).
 */
export const communityStartPostsInto =
  (group: string, categories: readonly string[]): CommunityStartPostsFor =>
  (posts, asked) =>
    asked === group ? categories.flatMap((category) => communityStartPostsIn(posts, category)) : [];

const postsOf = (options: CommunityStartTileOptions): CommunityStartPostsFor =>
  options.postsFor ?? communityStartPostsIn;

/** A post as a picker's card. */
export function communityStartTile(
  post: CommunityStartPost,
  { imageUrl, pictureClassName, note }: CommunityStartTileOptions,
): CommunityStartTile {
  const card = communityStartCard(post, { imageUrl, pictureClassName });
  return note ? { ...card, note: note(post) } : card;
}

/** A rail group's Community cards, best first (none for a group the posts leave out, as Recommended). */
export function communityStartCardsIn(
  posts: CommunityStartPosts,
  group: string,
  options: CommunityStartTileOptions,
): CommunityStartTile[] {
  return postsOf(options)(posts, group).map((post) => communityStartTile(post, options));
}

/**
 * A search's results with the Community's matches joined in, in the rail's order: each group's matching tiles after its
 * matching templates, and a group of the rail's that only the Community matched in its place among them. A group
 * outside the rail is left out, as it is when browsing; a group keeps its other fields (its `name`).
 */
export function withCommunityStartMatches<Card, C extends string = string>(
  results: readonly CommunityStartSearchGroup<Card, C>[],
  posts: CommunityStartPosts,
  query: string,
  rail: readonly C[],
  options: CommunityStartTileOptions,
): CommunityStartSearchGroup<Card | CommunityStartTile, C>[] {
  const postsFor = postsOf(options);
  const found = (group: C) =>
    postsFor(posts, group)
      .filter((post) => communityStartMatches(post, query))
      .map((post) => communityStartTile(post, options));
  const byGroup = new Map(results.map((g) => [g.category, g]));
  return rail
    .map((category): CommunityStartSearchGroup<Card | CommunityStartTile, C> => {
      const group = byGroup.get(category);
      const cards = [...(group?.cards ?? []), ...found(category)];
      return group ? { ...group, cards } : { category, cards };
    })
    .filter((g) => g.cards.length > 0);
}
