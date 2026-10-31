import type { CommunityPostState } from '@livedocuments/api-schema';

// Whether the editor header reads "Public" (docs/specs/025-community/community.md "Publishing"): for the owner,
// while their post is listed and the Community is on; for anyone who came in through the post's link, always,
// since the server only resolves that link while the post is public.
export function documentIsPublic(input: {
  communityOn: boolean;
  ownPostState: CommunityPostState | null;
  communitySession: boolean;
}): boolean {
  return (input.communityOn && input.ownPostState === 'listed') || input.communitySession;
}
