// Where the Community lives on the site (docs/specs/025-community/community.md "The Community app"). Kept apart
// from the rest of the Community vocabulary so a link to it (the apps menu, the footer, the editor's Community bar)
// never loads the categories, limits and validation with it.

// The Community's own address on the site (the router serves the Community app there).
export const COMMUNITY_HOME_PATH = '/community/';

// A post's own page on the site (the Community app is served at /community).
export function communityPostPath(postId: string): string {
  return `/community/post/?id=${encodeURIComponent(postId)}`;
}

// The live image a card shows, relative to the api base.
export function communityImagePath(shareCode: string): string {
  return `/share/${encodeURIComponent(shareCode)}/image.svg`;
}
