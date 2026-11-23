import type { ReactNode } from 'react';
import { SubscriptionProvider } from '../provider/SubscriptionProvider';
import { tokenOf } from '../testing';

export * from '../testing';

/** A provider over `fetcher`, signed in with the token `tok`, whose navigations land in `navigate`. */
export function withProvider(
  node: ReactNode,
  fetcher: typeof fetch,
  navigate: (url: string) => void = () => {},
  token: string | null = 'tok',
) {
  return (
    <SubscriptionProvider getToken={tokenOf(token)} fetch={fetcher} navigate={navigate}>
      {node}
    </SubscriptionProvider>
  );
}
