// The Community's own addresses (liveworkspace/docs/specs/007-community/community.md "Every app's Community"): every
// app serves its gallery at `/community` on its own site. In-app routes go through next/link, which adds the basePath
// itself; the app's own routes come from its binding (CommunitySite.links).

// The gallery, and a post's page, on the site (absolute, for a canonical address or a sitemap).
export const COMMUNITY_HOME_PATH = '/community/';
export function communityPostPath(postId: string): string {
  return `/community/post/?id=${encodeURIComponent(postId)}`;
}

// In-app (next/link adds `/community`).
export const postHref = (id: string) => `/post/?id=${encodeURIComponent(id)}`;
// A tag link filters the gallery by writing `#tag` into its search.
export const tagHref = (tag: string) => `/?q=${encodeURIComponent(`#${tag}`)}`;
