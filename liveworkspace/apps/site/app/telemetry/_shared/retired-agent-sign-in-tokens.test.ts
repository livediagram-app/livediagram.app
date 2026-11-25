import { describe, expect, it } from 'vitest';
import { isRetiredAgentSignInToken } from './retired-agent-sign-in-tokens';

// docs/specs/017-telemetry/telemetry.md "Retired features": an AI tool's and a CLI's tokens are liveworkspace.app's.
describe('isRetiredAgentSignInToken', () => {
  it('retires the tokens an AI tool or a CLI signed in with, which liveworkspace.app counts as its own', () => {
    expect(isRetiredAgentSignInToken('Token', 'Created', 'MCP')).toBe(true);
    expect(isRetiredAgentSignInToken('Token', 'Created', 'Cli')).toBe(true);
  });

  it('keeps tokens made by hand and revoked, and every other event', () => {
    expect(isRetiredAgentSignInToken('Token', 'Created', 'Manual')).toBe(false);
    expect(isRetiredAgentSignInToken('Token', 'Created', null)).toBe(false);
    expect(isRetiredAgentSignInToken('Token', 'Removed', null)).toBe(false);
    expect(isRetiredAgentSignInToken('Mcp', 'Used', 'MCP')).toBe(false);
  });
});
