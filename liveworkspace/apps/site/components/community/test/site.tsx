import type { ReactNode } from 'react';
import { COMMUNITY_APP_WORDS } from '@liveworkspace/community-ui/words';
import {
  CommunitySiteProvider,
  type CommunityHelpLinkProps,
  type CommunitySite,
  type CommunitySiteTelemetry,
} from '../client';
import { communityLinks } from '../lib/links';

// A Community binding for tests: the page on livediagram's address, showing its posts, with a quiet telemetry and a
// plain help link, each replaceable. The pages under test read it through CommunitySiteProvider.

const noop = () => {};

export const quietCommunityTelemetry: CommunitySiteTelemetry = {
  openedPost: noop,
  likedPost: noop,
  unlikedPost: noop,
  copiedPost: noop,
  reported: noop,
  searched: noop,
  selected: noop,
  openedHelp: noop,
};

function TestHelpLink({ article, children, className }: CommunityHelpLinkProps) {
  return (
    <a href={`/help/community/${article}/`} className={className}>
      {children}
    </a>
  );
}

/** Another app's origin, as the registry names it. */
export const testOrigin = (app: string) => `https://www.${app}.app`;

export function communityTestSite(overrides: Partial<CommunitySite> = {}): CommunitySite {
  return {
    pageApp: 'livediagram.app',
    ready: true,
    scope: 'livediagram.app',
    scopeControl: null,
    words: COMMUNITY_APP_WORDS['livediagram.app'],
    keyStorage: 'test:community-key',
    links: communityLinks('livediagram.app', testOrigin),
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
