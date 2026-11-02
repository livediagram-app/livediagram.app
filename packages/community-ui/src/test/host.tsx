import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { CommunityShareHostProvider, type CommunityShareHost } from '../share/host';
import { COMMUNITY_APP_WORDS } from '../share/words';

// A Community share host for tests: livediagram's words and categories, a client whose every call is a mock.
export function testHost(over: Partial<CommunityShareHost> = {}): CommunityShareHost {
  return {
    app: 'livediagram.app',
    words: COMMUNITY_APP_WORDS['livediagram.app'],
    client: {
      get: vi.fn(async () => null),
      publish: vi.fn(),
      remove: vi.fn(async () => {}),
      popularTags: vi.fn(async () => []),
    },
    postHref: (id) => `/community/post/?id=${id}`,
    ...over,
  };
}

export function withHost(ui: ReactNode, host: CommunityShareHost = testHost()) {
  return <CommunityShareHostProvider host={host}>{ui}</CommunityShareHostProvider>;
}
