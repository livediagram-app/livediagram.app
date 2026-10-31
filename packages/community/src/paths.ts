// Where an app's Community lives on its own site (liveworkspace/docs/specs/007-community/community.md "Every app's
// Community"): the same paths on every app's site, since each serves its gallery at /community. Kept apart from the
// rest of the contract (the `./paths` entry) so a link to the gallery (an apps menu, a footer, the editor's
// Community bar) never loads the categories, limits and validation with it.

// The gallery's own address on the app's site (the app's router serves its Community app there).
export const COMMUNITY_HOME_PATH = '/community/';

// A post's own page on the app's site.
export function communityPostPath(postId: string): string {
  return `/community/post/?id=${encodeURIComponent(postId)}`;
}

// The live image a post's card shows, relative to the app's api base (the community link's card image door).
export function communityImagePath(shareCode: string): string {
  return `/share/${encodeURIComponent(shareCode)}/image.svg`;
}

// Where an app's Community pages keep their per-browser key ("Likes"): the app's own, on its own origin.
export function communityKeyStorage(product: string): string {
  return `${product}:v2:community-key`;
}
