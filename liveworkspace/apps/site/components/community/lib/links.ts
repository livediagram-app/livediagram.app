import {
  COMMUNITY_HOME_PATH,
  communityImagePath,
  communityPostPath,
  communityViewerPath,
} from '@liveworkspace/community/paths';
import type { CommunityApp } from '@liveworkspace/community';
import { appSignInHref } from '@liveworkspace/account-menu';
import type { AppName } from '@liveworkspace/sites';

// The Community's addresses (liveworkspace/docs/specs/007-community/community.md "One page for every app"). The pages
// are liveworkspace.app's, served on every app's address by its router, so a path here is the same on each: the gallery
// at `/community`, a post at `/community/post?id=`. A post always opens on its own app's address, where its viewer,
// embed and copy live; a card for a post of another app (All Apps) is a full link there.

export { COMMUNITY_HOME_PATH, communityPostPath };

// A tag link filters the gallery by writing `#tag` into its search.
export const tagHref = (tag: string) => `${COMMUNITY_HOME_PATH}?q=${encodeURIComponent(`#${tag}`)}`;

/** An app named the way the Community names it (`livediagram.app`), as the platform's registry does (`livediagram`). */
export const appNameOf = (app: CommunityApp): AppName => app.replace(/\.app$/, '') as AppName;

/** The Community app of a registry app (`livediagram` to `livediagram.app`). */
export const communityAppOf = (app: AppName): CommunityApp => `${app}.app`;

/** Where a link to a post goes: this address's own page (`external` false, a client-side move) or the post's app's. */
export type PostLink = { href: string; external: boolean };

type PostAddress = { id: string; app: CommunityApp };
type PostDocument = { app: CommunityApp; shareCode: string };

/** Every address the pages link to, worked out for the page's own app: a post's own things (its page, its image, its
 *  viewer, its copy, its embed, the author's document) are on the post's app's address, relative when that is this
 *  page's. Plain anchors except a post's page on this address: the rest are the apps' pages, not this site's. */
export type CommunitySiteLinks = {
  post: (post: PostAddress) => PostLink;
  /** The post's live card image (its app's api, from the document's latest snapshot). */
  image: (post: PostDocument) => string;
  /** The read-only viewer, full screen. */
  openDocument: (post: PostDocument) => string;
  /** The viewer, which copies the document into the visitor's own documents in one step. */
  makeCopy: (post: PostDocument) => string;
  /** The interactive read-only embed the post page frames. */
  embed: (post: PostDocument) => string;
  /** The author's own document in the editor (My Shares, for a hidden post). */
  editDocument: (post: { app: CommunityApp; documentId: string }) => string;
  /** The app's own sign-in on this address, returning to `returnTo` afterwards (My Shares). */
  signIn: (returnTo: string) => string;
  /** Where every Share Your Own invitation leads: the person's own things (Explorer Home), on this app's address, or
   *  liveworkspace.app's own Explorer. */
  shareYourOwn: string;
};

const shareQuery = (shareCode: string) => `s=${encodeURIComponent(shareCode)}`;
// livedesign's documents are designs and liveplanner's are projects; every other app's are documents (the editor's own
// address, as `communityViewerPath` names the viewer's).
const kindOf = (app: CommunityApp) =>
  app === 'livedesign.app' ? 'design' : app === 'liveplanner.app' ? 'project' : 'document';

/** The links for a page on `pageApp`'s address (null: liveworkspace.app's), with `originOf` naming another app's
 *  origin (@/lib/explorer/page-app appOrigin). */
export function communityLinks(
  pageApp: CommunityApp | null,
  originOf: (app: AppName) => string,
): CommunitySiteLinks {
  const on = (app: CommunityApp, path: string) =>
    app === pageApp ? path : `${originOf(appNameOf(app))}${path}`;
  return {
    post: (post) => {
      const path = communityPostPath(post.id);
      return post.app === pageApp
        ? { href: path, external: false }
        : { href: on(post.app, path), external: true };
    },
    image: (post) => on(post.app, `/api${communityImagePath(post.shareCode)}`),
    openDocument: (post) => on(post.app, communityViewerPath(post.app, post.shareCode)),
    makeCopy: (post) => on(post.app, communityViewerPath(post.app, post.shareCode, true)),
    embed: (post) => on(post.app, `/embed?${shareQuery(post.shareCode)}`),
    editDocument: (post) =>
      on(post.app, `/${kindOf(post.app)}/${encodeURIComponent(post.documentId)}`),
    signIn: appSignInHref,
    shareYourOwn: pageApp ? '/explorer/home' : '/explorer',
  };
}
