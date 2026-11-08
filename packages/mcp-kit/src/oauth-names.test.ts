import { describe, expect, it } from 'vitest';
import { reservedNameRefusal } from './oauth-names';

// Names a registered client may not take (liveworkspace/docs/specs/003-accounts/blueprints/oauth.md "Registered
// clients").

const EVIL = ['https://evil.test/cb'];
const LOOPBACK = [
  'http://127.0.0.1:9/callback',
  'http://[::1]:9/callback',
  'http://localhost:9/cb',
];

describe('reservedNameRefusal', () => {
  it('finds one of our apps at any word start, in any case or width, across punctuation and camel case', () => {
    for (const name of [
      'livediagram',
      'LiveDocuments CLI',
      'live designs',
      'My.LiveHuddle',
      'officialLivePlanner',
      'ＬＩＶＥＷＯＲＫＳＰＡＣＥ',
      'livepages',
    ])
      expect(reservedNameRefusal(name, EVIL)).toMatch(/^client_name live\w+ is reserved$/);
  });

  it('lets a name that only contains one of them mid-word through', () => {
    expect(reservedNameRefusal('Olivediagrams', EVIL)).toBeNull();
    expect(reservedNameRefusal('Precursor', EVIL)).toBeNull();
    expect(reservedNameRefusal('Notion', EVIL)).toBeNull();
  });

  it('passes any reserved name whose code stays on this machine', () => {
    expect(reservedNameRefusal('livediagram helper', LOOPBACK)).toBeNull();
    expect(reservedNameRefusal('Claude Code (livediagram)', LOOPBACK)).toBeNull();
  });

  it('passes a well-known tool only on its own domains, which may then name our server', () => {
    expect(reservedNameRefusal('Claude', ['https://claude.ai/api/mcp/auth_callback'])).toBeNull();
    expect(reservedNameRefusal('Claude', ['https://claude.com/api/mcp/auth_callback'])).toBeNull();
    expect(
      reservedNameRefusal('ChatGPT', ['https://chatgpt.com/connector_platform_oauth_redirect']),
    ).toBeNull();
    expect(reservedNameRefusal('OpenAI Agent', ['https://platform.openai.com/cb'])).toBeNull();
    expect(reservedNameRefusal('Cursor', ['https://cursor.com/cb'])).toBeNull();
    expect(reservedNameRefusal('Claude for livediagram', ['https://claude.ai/cb'])).toBeNull();
    expect(reservedNameRefusal('Claude', ['https://claude.ai.evil.test/cb'])).toBe(
      'client_name claude is reserved',
    );
    expect(reservedNameRefusal('Cursor', ['https://chatgpt.com/cb'])).toBe(
      'client_name cursor is reserved',
    );
    expect(reservedNameRefusal('ChatGPT', ['https://chatgpt.com/cb', ...EVIL])).toBe(
      'client_name chatgpt is reserved',
    );
  });

  it('reads an unparseable redirect as elsewhere', () => {
    expect(reservedNameRefusal('Claude', ['not a url'])).toBe('client_name claude is reserved');
  });
});
