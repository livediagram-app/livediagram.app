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

// Your own document in the editor (My Shares, for a post that is hidden).
export const editDocumentHref = (documentId: string) =>
  `/document/${encodeURIComponent(documentId)}`;

// In-app (next/link adds `/community`).
export const postHref = (id: string) => `/post/?id=${encodeURIComponent(id)}`;
// A tag link filters the gallery by writing `#tag` into its search.
export const tagHref = (tag: string) => `/?q=${encodeURIComponent(`#${tag}`)}`;

// Sharing starts from a document the person already has (docs/specs/025-community/community.md "Gallery"),
// so both invitations open Explorer Home, where their documents are, rather than a new document.
export const SHARE_YOUR_OWN_HREF = '/explorer/home';
export const EMPTY_INVITE_HREF = '/explorer/home';
