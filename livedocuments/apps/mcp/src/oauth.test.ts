import { describe, expect, it } from 'vitest';
import { CLI_CLIENT_ID, CLI_CLIENT_NAME } from '@livedocuments/api-schema';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { OAUTH } from './oauth';

// The authorization server itself is @liveworkspace/mcp-kit's, tested there; what is this product's is its
// configuration.
describe('the authorization server', () => {
  it('ships livedocuments CLI as its one built-in client', () => {
    expect(Object.keys(OAUTH.builtInClients)).toEqual([CLI_CLIENT_ID]);
    expect(OAUTH.builtInClients[CLI_CLIENT_ID]?.clientName).toBe(CLI_CLIENT_NAME);
  });

  it('sends people to the hosted editor unless CONSENT_BASE_URL names another', () => {
    expect(OAUTH.appBase({} as Env)).toBe('https://www.livedocuments.app');
    expect(OAUTH.appBase({ CONSENT_BASE_URL: 'https://live.test' } as Env)).toBe(
      'https://live.test',
    );
  });
});
