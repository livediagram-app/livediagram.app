import type { ReactNode } from 'react';
import { COMMUNITY_APP_WORDS } from '@liveworkspace/community-ui/words';
import {
  CommunitySiteProvider,
  type CommunityHelpLinkProps,
  type CommunitySite,
  type CommunitySiteTelemetry,
} from '../client';

// A Community binding for tests (`@liveworkspace/community-site/testing`): livediagram's words and routes, a quiet
// telemetry and a plain help link, each replaceable. The pages under test read it through CommunitySiteProvider.

const noop = () => {};

export const quietCommunityTelemetry: CommunitySiteTelemetry = {
  openedPost: noop,
  likedPost: noop,
  unlikedPost: noop,
  copiedPost: noop,
  reported: noop,
  searched: noop,
  selected: noop,
};

function TestHelpLink({ article, children, className }: CommunityHelpLinkProps) {
  return (
    <a href={`/help/community/${article}/`} className={className}>
      {children}
    </a>
  );
}

const shareQuery = (shareCode: string) => `s=${encodeURIComponent(shareCode)}`;

export function communityTestSite(overrides: Partial<CommunitySite> = {}): CommunitySite {
  return {
    app: 'livediagram.app',
    words: COMMUNITY_APP_WORDS['livediagram.app'],
    apiBase: '/api',
    keyStorage: 'test:community-key',
    signedInHint: (cookie) => {
      const value = /(?:^|;\s*)ld_signed_in=([01])/.exec(cookie)?.[1];
      return value === undefined ? null : value === '1';
    },
    links: {
      openDocument: (code) => `/document/shared?${shareQuery(code)}`,
      makeCopy: (code) => `/document/shared?${shareQuery(code)}&copy=1`,
      embed: (code) => `/embed?${shareQuery(code)}`,
      image: (code) => `/api/share/${encodeURIComponent(code)}/image.svg`,
      editDocument: (id) => `/document/${encodeURIComponent(id)}`,
      signIn: (returnTo) => `/sign-in/?redirect_url=${encodeURIComponent(returnTo)}`,
      shareYourOwn: '/explorer/home',
    },
    telemetry: quietCommunityTelemetry,
    HelpLink: TestHelpLink,
    ...overrides,
  };
}

/** A render wrapper: `render(ui, { wrapper: withCommunitySite(site) })`. */
export function withCommunitySite(site: CommunitySite = communityTestSite()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <CommunitySiteProvider site={site}>{children}</CommunitySiteProvider>;
  };
}
