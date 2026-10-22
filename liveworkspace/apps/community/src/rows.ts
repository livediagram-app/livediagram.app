// posts rows (migrations/0001_community.sql) and their mapping to the wire shapes. Pure, so the defensive
// parsing has a test surface without D1.

import {
  COMMUNITY_ANONYMOUS_AUTHOR,
  isCommunityCategory,
  type CommunityAuthor,
  type CommunityPost,
  type CommunityPostState,
} from '@liveworkspace/community';

export type PostRow = {
  id: string;
  app: string;
  document: string;
  share_code: string;
  owner: string;
  author_name: string;
  author_color: string;
  author_picture: string | null;
  anonymous: number;
  title: string;
  description: string;
  category: string;
  tags: string;
  document_state: string;
  like_count: number;
  copy_count: number;
  state: string;
  hidden_at: number | null;
  published_at: number;
  updated_at: number;
};

// The SELECT list every post read uses; `p` is posts.
export const POST_COLS = `p.id, p.app, p.document, p.share_code, p.owner, p.author_name, p.author_color,
  p.author_picture, p.anonymous, p.title, p.description, p.category, p.tags, p.document_state, p.like_count,
  p.copy_count, p.state, p.hidden_at, p.published_at, p.updated_at`;

// What the public sees, of one app: listed (not hidden after reports), and its document public in its
// app. The app binds first.
export const PUBLIC_POST = `p.app = ? AND p.state = 'listed' AND p.document_state = 'public'`;

// A tags column that isn't a JSON array of strings reads as no tags rather than failing the whole list.
export function parseTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

// Who a post shows: "Anonymous" when the author chose it, else how their app last showed them.
export function rowAuthor(row: PostRow): CommunityAuthor {
  if (row.anonymous) return COMMUNITY_ANONYMOUS_AUTHOR;
  return { name: row.author_name, color: row.author_color, picture: row.author_picture };
}

// The public shape: never the owner or the app's document id. `liked` comes from the caller's
// community key.
export function rowToPost(row: PostRow, liked: boolean): CommunityPost {
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

export function rowState(row: PostRow): CommunityPostState {
  return row.state === 'hidden' ? 'hidden' : 'listed';
}

// What search matches against: lowercased title, description and tags.
export function searchText(title: string, description: string, tags: string[]): string {
  return `${title}\n${description}\n${tags.join(' ')}`.toLowerCase();
}

// Escape a term for a LIKE pattern with ESCAPE '\'.
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// A post id: ten characters from an unambiguous alphabet, as livediagram's share codes are.
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 256 is not a multiple of the alphabet's 55, so drawing by modulo would favour its first letters a
// little: bytes from this limit up are skipped.
const UNBIASED_LIMIT = 256 - (256 % ID_ALPHABET.length);

export function newPostId(length = 10): string {
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length))) {
      if (b < UNBIASED_LIMIT && out.length < length) out += ID_ALPHABET[b % ID_ALPHABET.length];
    }
  }
  return out;
}
