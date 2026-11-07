import { COMMUNITY_UNKNOWN_AUTHOR, type CommunityShareInfo } from '@liveworkspace/community';

// The Community post a community link belongs to (`GET /api/share/<code>`'s `community`;
// liveworkspace/docs/specs/007-community/community.md), or null for an ordinary link. Tolerant of a malformed field:
// a link that can't be read as a Community one opens as an ordinary view link.
export function readCommunityShareInfo(raw: unknown): CommunityShareInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const { postId, author } = raw as { postId?: unknown; author?: unknown };
  if (typeof postId !== 'string' || !postId || !author || typeof author !== 'object') return null;
  const a = author as { name?: unknown; color?: unknown; picture?: unknown };
  return {
    postId,
    author: {
      name: typeof a.name === 'string' && a.name ? a.name : COMMUNITY_UNKNOWN_AUTHOR.name,
      color: typeof a.color === 'string' && a.color ? a.color : COMMUNITY_UNKNOWN_AUTHOR.color,
      picture: typeof a.picture === 'string' && a.picture ? a.picture : null,
    },
  };
}
