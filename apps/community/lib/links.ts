import { ctaHref } from '@livediagram/api-schema';

// Where the Community app links out to (docs/specs/025-community/community.md "Post"). The editor
// routes sit outside this app's `/community` basePath, so they are plain origin-absolute hrefs used
// with <a>, never next/link. In-app routes go through next/link, which adds the basePath itself.

const shareQuery = (shareCode: string) => `s=${encodeURIComponent(shareCode)}`;

// The read-only viewer, full screen.
export const openBoardHref = (shareCode: string) => `/document/shared?${shareQuery(shareCode)}`;

// The viewer, which copies the document into the visitor's own documents in one step.
export const makeCopyHref = (shareCode: string) =>
  `/document/shared?${shareQuery(shareCode)}&copy=1`;

// The interactive read-only embed the post page frames.
export const embedHref = (shareCode: string) => `/embed?${shareQuery(shareCode)}`;

// In-app (next/link adds `/community`).
export const postHref = (id: string) => `/post/?id=${encodeURIComponent(id)}`;
export const tagHref = (tag: string) => `/?tag=${encodeURIComponent(tag)}`;

export const SHARE_YOUR_OWN_HREF = ctaHref('/new', 'Community.Hero');
export const EMPTY_INVITE_HREF = ctaHref('/new', 'Community.Empty');
