// community_posts rows (migration 0068, docs/specs/025-community/blueprints/community.md §3) and their mapping to
// the wire shapes. Pure, so the defensive parsing has a test surface without D1, like share-link-row.ts.

import {
  COMMUNITY_ANONYMOUS_AUTHOR,
  COMMUNITY_UNKNOWN_AUTHOR,
  isCommunityCategory,
  type CommunityAuthor,
  type CommunityPost,
  type CommunityPostState,
} from '@livediagram/api-schema';

// The post columns plus the author's participant columns from the LEFT JOIN (null when the author has no row).
export type CommunityPostRow = {
  id: string;
  document_id: string;
  share_code: string;
  author_id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  like_count: number;
  copy_count: number;
  state: string;
  hidden_by: string | null;
  published_at: number;
  updated_at: number;
  anonymous: number;
  author_name: string | null;
  author_color: string | null;
  author_picture: string | null;
};

// The SELECT list every post read uses; `cp` is community_posts, `pa` the author's participants row.
export const COMMUNITY_POST_COLS = `cp.id, cp.document_id, cp.share_code, cp.author_id, cp.title, cp.description,
  cp.category, cp.tags, cp.like_count, cp.copy_count, cp.state, cp.hidden_by, cp.published_at, cp.updated_at,
  cp.anonymous,
  pa.name AS author_name, pa.color AS author_color, pa.picture_url AS author_picture`;

export const COMMUNITY_POST_FROM = `community_posts cp
  JOIN documents d ON d.id = cp.document_id
  LEFT JOIN participants pa ON pa.id = cp.author_id`;

// A tags column that isn't a JSON array of strings reads as no tags rather than failing the whole list.
export function parseTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

// Who a post shows: "Anonymous" when the author chose it, else their display identity.
export function rowAuthor(row: CommunityPostRow): CommunityAuthor {
  if (row.anonymous) return COMMUNITY_ANONYMOUS_AUTHOR;
  if (!row.author_name) return COMMUNITY_UNKNOWN_AUTHOR;
  return {
    name: row.author_name,
    color: row.author_color ?? COMMUNITY_UNKNOWN_AUTHOR.color,
    picture: row.author_picture ?? null,
  };
}

// The public shape: never the author's id or the document id. `liked` comes from the caller's community key.
export function rowToCommunityPost(row: CommunityPostRow, liked: boolean): CommunityPost {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: isCommunityCategory(row.category) ? row.category : 'other',
    tags: parseTags(row.tags),
    likeCount: row.like_count,
    copyCount: row.copy_count,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    shareCode: row.share_code,
    author: rowAuthor(row),
    anonymous: row.anonymous === 1,
    liked,
  };
}

export function rowState(row: CommunityPostRow): CommunityPostState {
  return row.state === 'hidden' ? 'hidden' : 'listed';
}

// What search matches against (blueprint §3): lowercased title, description and tags.
export function communitySearchText(title: string, description: string, tags: string[]): string {
  return `${title}\n${description}\n${tags.join(' ')}`.toLowerCase();
}

// Escape a term for a LIKE pattern with ESCAPE '\' (blueprint §7).
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
