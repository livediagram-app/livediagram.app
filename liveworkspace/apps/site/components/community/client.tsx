'use client';

import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { CommunityApp, CommunityScope } from '@liveworkspace/community';
import type { CommunityWords } from '@liveworkspace/community-ui/words';
import type { AppScope } from '@liveworkspace/ui';
import type { CommunitySiteTelemetry } from '@/lib/community/telemetry';
import { createCommunityApi, type CommunityApi } from './lib/api';
import type { CommunitySiteLinks } from './lib/links';

export type { CommunitySelection, CommunitySiteTelemetry } from '@/lib/community/telemetry';

// What the Community page's components read (liveworkspace/docs/specs/007-community/community.md "One page for every
// app"). The page is liveworkspace.app's, and the same wherever it is served; what differs is where: the app whose
// address it is on (its posts by default, its words, its routes, its session, its telemetry and its help), or none on
// liveworkspace.app, where it shows every app's posts. CommunityBinding.tsx works that out from the page's address and
// mounts the provider; the tests mount it with a binding of their own (test/site.tsx).

/** A deep link into the help centre, to one of the Community's two articles. */
export type CommunityHelpLinkProps = {
  article: 'sharing' | 'finding';
  children: string;
  variant?: 'quiet' | 'inline' | 'button';
  className?: string;
};

/** The "this app or All Apps" switch: on an app's address only. */
export type CommunityScopeControl = { value: AppScope; set: (next: AppScope) => void };

export interface CommunitySite {
  /** The app whose address the page is on, or null on liveworkspace.app (and while prerendered). */
  pageApp: CommunityApp | null;
  /** Whether the page knows where it is yet: false while prerendered and hydrating, when nothing loads. */
  ready: boolean;
  /** Whose posts the gallery shows: the page's app's, or every app's. */
  scope: CommunityScope;
  /** The switch between them, where there is a choice (an app's address); null on liveworkspace.app. */
  scopeControl: CommunityScopeControl | null;
  /** The scope's words: an app's (COMMUNITY_APP_WORDS), or every app's together. */
  words: CommunityWords;
  /** The Community service the build names (NEXT_PUBLIC_COMMUNITY_API); unset means liveworkspace.app's as seen from
   *  the page. */
  communityApi?: string;
  /** Where the per-browser community key is kept in localStorage: the app's own, on its own origin. */
  keyStorage: string;
  links: CommunitySiteLinks;
  telemetry: CommunitySiteTelemetry;
  /** The help deep link (it sends the app's `UI·Opened` event). */
  HelpLink: ComponentType<CommunityHelpLinkProps>;
}

/** What the components read: the binding, and its Community api client. */
export type CommunitySiteValue = CommunitySite & { api: CommunityApi };

const CommunitySiteContext = createContext<CommunitySiteValue | null>(null);

export function useCommunitySite(): CommunitySiteValue {
  const site = useContext(CommunitySiteContext);
  if (!site)
    throw new Error(
      'A Community component rendered outside CommunitySiteProvider (app/community/layout.tsx).',
    );
  return site;
}

/** Hands the binding, with an api client for its scope, to every Community component below it. */
export function CommunitySiteProvider({
  site,
  children,
}: {
  site: CommunitySite;
  children: ReactNode;
}) {
  const { scope, pageApp, communityApi, keyStorage } = site;
  // A new client only when what it asks for changes, so a scope switch reloads the gallery and nothing else does.
  const api = useMemo(
    () => createCommunityApi({ scope, pageApp, communityApi, keyStorage }),
    [scope, pageApp, communityApi, keyStorage],
  );
  const value = useMemo<CommunitySiteValue>(() => ({ ...site, api }), [site, api]);
  return <CommunitySiteContext value={value}>{children}</CommunitySiteContext>;
}
