// Links from the editor into the Community app (docs/specs/025-community/community.md "The Community
// app"), which the router serves on the same origin at /community.

export const COMMUNITY_HOME_PATH = '/community/';

// A post's page: where View Post and Back to Community go.
export function communityPostPath(postId: string): string {
  return `/community/post/?id=${encodeURIComponent(postId)}`;
}

