import { describe, expect, it } from 'vitest';
import { CLI_CLIENT_ID, CLI_CLIENT_NAME } from './oauth-clients';

// docs/specs/015-api/blueprints/cli.md "OAuth server", CLI35; the user codes are tested in @liveworkspace/api-kit.

describe('the CLI client', () => {
  it('is a fixed id and name', () => {
    expect(CLI_CLIENT_ID).toBe('livedesign-cli');
    expect(CLI_CLIENT_NAME).toBe('livedesign CLI');
  });
});
