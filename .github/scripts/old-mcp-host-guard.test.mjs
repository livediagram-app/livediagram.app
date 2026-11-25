import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findOldHosts, OLD_HOST } from './old-mcp-host-guard.mjs';

// The old MCP host guard (liveworkspace/docs/specs/021-mcp/mcp.md "What people are told").

describe('OLD_HOST', () => {
  it('matches production and staging spellings of an app host, never the one address', () => {
    assert.equal(OLD_HOST.test('https://mcp.livediagram.app/mcp'), true);
    assert.equal(OLD_HOST.test('https://mcp-staging.liveplanner.app/mcp'), true);
    assert.equal(OLD_HOST.test('https://mcp.liveworkspace.app/mcp'), false);
    assert.equal(OLD_HOST.test('https://mcp-staging.liveworkspace.app/mcp'), false);
  });
});

describe('findOldHosts', () => {
  const text = 'connect https://mcp.livedocuments.app/mcp';

  it('names a page, help article or README that carries one', () => {
    const files = [
      'livediagram/apps/marketing/lib/faq-content.tsx',
      'liveworkspace/apps/help/app/plan/cards/page.mdx',
      'livedesign/README.md',
    ];
    assert.deepEqual(
      findOldHosts(files, () => text),
      files,
    );
  });

  it('leaves the Worker, tests, the migration note, specs, developer docs and fixtures alone', () => {
    const files = [
      'liveworkspace/apps/mcp/wrangler.toml',
      'liveworkspace/apps/mcp/src/old-hosts.ts',
      'packages/marketing-site/src/lib/ai-clients.test.ts',
      'packages/marketing-site/src/components/ai/AiTroubleshooting.tsx',
      'liveworkspace/apps/help/app/account-and-data/connect-ai-mcp/page.mdx',
      'liveworkspace/apps/help/app/account-and-data/connect-ai-mcp/ai-clients/page.mdx',
      'docs/structure.md',
      'livediagram/docs/specs/015-api/mcp-server.md',
      'liveplanner/docs/development/architecture.md',
      'packages/agent-markdown/fixtures/marketing-miro.html',
    ];
    assert.deepEqual(
      findOldHosts(files, () => text),
      [],
    );
  });

  it('reads only text files, and only the ones it must', () => {
    const read = [];
    findOldHosts(['a/logo.png', 'a/b.tsx', 'liveworkspace/apps/mcp/x.ts'], (file) => {
      read.push(file);
      return '';
    });
    assert.deepEqual(read, ['a/b.tsx']);
  });
});
