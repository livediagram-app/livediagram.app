import type { CommunityMinePost, CommunityPost } from '@livediagram/api-schema';

// A post in a grid: a public one, or, in My Shares (docs/specs/025-community/community.md "My Shares"), one of
// the author's own with its state and document.
export type GalleryPost = CommunityPost | CommunityMinePost;

export function isMinePost(post: GalleryPost): post is CommunityMinePost {
  return 'documentId' in post;
}
