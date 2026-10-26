// How the apps talk to liveworkspace's Community service (liveworkspace/docs/community.md "The API"):
// where it lives, and the shapes its app-only routes take and give. The public routes' shapes are the
// wire shapes in ./post.

import type { CommunityApp } from './apps';
import type { CommunityAuthor } from './authors';
import type { CommunityMineResponse, CommunityOwnPost, CommunityPostInput } from './post';

// The service's API on liveworkspace.app. Every app's pages and Workers call it here.
export const COMMUNITY_API_PATH = '/api/community';
export const COMMUNITY_API_URL = `https://www.liveworkspace.app${COMMUNITY_API_PATH}`;

// Every public read names its app in this query parameter; a post of another app answers as missing.
export const COMMUNITY_APP_PARAM = 'app';

// A public route of the service, for one app's posts: `path` under the API (`/posts`, `/facets`, ...), `search`
// the rest of the query, `base` the service's API when not production's (staging's, a local one).
export function communityServiceUrl(
  app: CommunityApp,
  path: string,
  { base, search }: { base?: string | null; search?: string } = {},
): string {
  const params = new URLSearchParams(search);
  params.set(COMMUNITY_APP_PARAM, app);
  return `${base || COMMUNITY_API_URL}${path}?${params}`;
}

// The app routes (`/api/community/app/*`) are for an app's own Workers, never a browser: they carry
// the app's key as a bearer token and name the app in this header.
export const COMMUNITY_APP_HEADER = 'X-Community-App';

// A post as its app sees it (`GET` and `PUT /app/documents/<document>`): the owner's view, with its
// state, and whether the asking owner is its author. A post made by a document's previous owner (the
// document left a team library for another member's) is not theirs, and publishing replaces it.
export type CommunityAppPost = CommunityOwnPost & { own: boolean };
export type CommunityAppPostResponse = { post: CommunityAppPost | null };

// Where a post's document stands in its app (liveworkspace/docs/community.md "Keeping in step"):
//   - 'public': it passes the app's public rule, so the post is listed (unless hidden after reports);
//   - 'closed': it is in a team library or has a share password. Not listed, but still its author's, so
//     still in their My Shares;
//   - 'away': it is in the Trash, or now belongs to someone other than the post's author. Not listed,
//     and not in My Shares either.
export const COMMUNITY_DOCUMENT_STATES = ['public', 'closed', 'away'] as const;
export type CommunityDocumentState = (typeof COMMUNITY_DOCUMENT_STATES)[number];

export function isCommunityDocumentState(value: unknown): value is CommunityDocumentState {
  return (
    typeof value === 'string' && (COMMUNITY_DOCUMENT_STATES as readonly string[]).includes(value)
  );
}

// `PUT /app/documents/<document>`: publish, or save an Edit Listing. The app has already checked that
// `owner` owns the document and may publish it; `shareCode` is the community link it made for it.
// `author` is how the owner is shown when the post is not anonymous: the service keeps a copy,
// refreshed on every publish and edit. `create` says the app holds no post of this owner's for the
// document, so it means a first publish: should one exist after all (two publishes at once), the
// answer is `already_published` rather than an edit pointing at another community link.
export type CommunityAppPublish = {
  owner: string;
  shareCode: string;
  documentState: CommunityDocumentState;
  author: CommunityAuthor;
  input: CommunityPostInput;
  create?: boolean;
};

// `POST /app/sync`: what changed about the app's posts' documents since it last said: each one's state,
// and the documents deleted for good, whose posts go with them.
export type CommunityAppSync = {
  documents: { document: string; state: CommunityDocumentState }[];
  gone: string[];
};

// `GET /app/hidden?since=<ms>`: the app's posts hidden after reports at or after `since`, so the app
// can close their community links. Hidden is final, so the list only grows.
export type CommunityAppHiddenResponse = { hidden: { document: string; hiddenAt: number }[] };

// `GET /app/mine?owner=<owner>&…`: My Shares, for an owner the app has signed in. The same as the
// public list's query; `documentId` on each post is the app's document.
export type CommunityAppMineResponse = CommunityMineResponse;

// `POST /app/copies`: someone copied a post's document through its community link. `copier` is a
// one-way hash of who (never a guest's owner id, which is a credential); `ip` names their network,
// stored only as a hash salted with the post.
export type CommunityAppCopy = { document: string; copier: string; ip: string };

// `POST /app/copiers/forget` (an account was deleted) and `/app/copiers/merge` (a guest's work moved
// to their new account): copies are counted per person, so the person's copies follow them.
export type CommunityAppForget = { copier: string };
export type CommunityAppMerge = { from: string; to: string };

// The most a sync carries: a bigger backlog goes over several.
export const COMMUNITY_SYNC_MAX = 500;
