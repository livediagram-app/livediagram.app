'use client';

import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { CommunityApp } from '@liveworkspace/community';
import type { CommunityWords } from '@liveworkspace/community-ui/words';
import { createCommunityApi, type CommunityApi } from './lib/api';

// The app's half of the Community pages' browser code (README.md "Binding an app";
// liveworkspace/docs/specs/007-community/community.md "Shared pieces"). The gallery and post pages are the same in every
// app; what differs is the app's: which posts are its own, its words, where its api and editor routes are, how it
// tells who is signed in, its telemetry and its help links. Functions cannot cross from a server component to a client
// one, so the app's root layout mounts its own small client provider once, around every page (as help-site does),
// and these components read what it hands over.

/** The gallery filters the Community sends as `Community·Selected·<type>`. */
export type CommunitySelection = 'Category' | 'Tag' | 'Sort' | 'Mine';

/** The app's Community telemetry, each event a preset value, never post content (no titles, tags or search text). */
export type CommunitySiteTelemetry = {
  openedPost: () => void;
  likedPost: () => void;
  unlikedPost: () => void;
  copiedPost: () => void;
  /** `reasonType` is the reason's PascalCase type from COMMUNITY_REPORT_REASONS. */
  reported: (reasonType: string) => void;
  searched: () => void;
  selected: (what: CommunitySelection) => void;
};

/** The app's routes the pages link out to. They sit outside the `/community` basePath, so they are origin-absolute
 *  hrefs used with plain anchors, never next/link. */
export type CommunitySiteLinks = {
  /** The read-only viewer, full screen. */
  openDocument: (shareCode: string) => string;
  /** The viewer, which copies the document into the visitor's own documents in one step. */
  makeCopy: (shareCode: string) => string;
  /** The interactive read-only embed the post page frames. */
  embed: (shareCode: string) => string;
  /** The post's live card image (the api's, from the document's latest snapshot). */
  image: (shareCode: string) => string;
  /** The author's own document in the editor (My Shares, for a hidden post). */
  editDocument: (documentId: string) => string;
  /** The app's sign-in page, returning to `returnTo` afterwards. */
  signIn: (returnTo: string) => string;
  /** Where every Share Your Own invitation leads: the person's own documents (Explorer Home). */
  shareYourOwn: string;
};

/** A deep link into the app's help centre, to one of the Community's two articles. */
export type CommunityHelpLinkProps = {
  article: 'sharing' | 'finding';
  children: string;
  variant?: 'quiet' | 'inline' | 'button';
  className?: string;
};

export interface CommunitySite {
  /** Whose posts these pages show. */
  app: CommunityApp;
  /** The app's words (COMMUNITY_APP_WORDS from @liveworkspace/community-ui/words). */
  words: CommunityWords;
  /** The app's own api (My Shares, the session, capabilities): '/api' behind the router. */
  apiBase: string;
  /** The Community service the build names (NEXT_PUBLIC_COMMUNITY_API); unset means liveworkspace.app's as seen from
   *  the page. */
  communityApi?: string;
  /** Where the per-browser community key is kept in localStorage: the app's own, on its own origin. */
  keyStorage: string;
  /** The app's readable signed-in hint, from `document.cookie`: true, false, or null when the browser has none. */
  signedInHint: (cookie: string) => boolean | null;
  links: CommunitySiteLinks;
  telemetry: CommunitySiteTelemetry;
  /** The app's help deep link (it sends the app's own `UI·Opened` event). */
  HelpLink: ComponentType<CommunityHelpLinkProps>;
}

/** What the components read: the app's binding, and its Community api client. */
export type CommunitySiteValue = CommunitySite & { api: CommunityApi };

const CommunitySiteContext = createContext<CommunitySiteValue | null>(null);

export function useCommunitySite(): CommunitySiteValue {
  const site = useContext(CommunitySiteContext);
  if (!site)
    throw new Error(
      'A Community component rendered outside CommunitySiteProvider (app/layout.tsx).',
    );
  return site;
}

/** The provider every Community app's root layout wraps its body in, with the app's binding. */
export function CommunitySiteProvider({
  site,
  children,
}: {
  site: CommunitySite;
  children: ReactNode;
}) {
  const value = useMemo<CommunitySiteValue>(
    () => ({ ...site, api: createCommunityApi(site) }),
    [site],
  );
  return <CommunitySiteContext value={value}>{children}</CommunitySiteContext>;
}
