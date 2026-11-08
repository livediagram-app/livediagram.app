import type { ReactNode } from 'react';
import { createIndexClient } from '@liveworkspace/index-client';
import { AccountPanelsProvider, type AccountPanelsHost } from '../account-panels/host';
import { bearerSettingsRequest } from '../request';

// The account panels' host as the tests draw them: the account API under /api/account and the index under /api/index,
// each with the token `tok`, over the global fetch the test stubs.
export const TEST_ACCOUNT_HOST: AccountPanelsHost = {
  request: bearerSettingsRequest({ baseUrl: '/api/account', token: async () => 'tok' }),
  index: createIndexClient({ getToken: async () => 'tok' }),
};

export function withAccountHost(node: ReactNode) {
  return <AccountPanelsProvider host={TEST_ACCOUNT_HOST}>{node}</AccountPanelsProvider>;
}
