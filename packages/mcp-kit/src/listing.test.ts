// The listing a product's server.json, initialize serverInfo and server card are made from (each product's
// docs/specs/015-api/mcp-server.md §4.16), and the card createMcpApp serves.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMcpApp } from './app';
import type { OauthEnv } from './oauth-clients';
import {
  mcpListing,
  registryDescriptor,
  serverCard,
  serverIdentity,
  SERVER_CARD_PATH,
} from './listing';
import { serverJsonProblems } from './server-json';

const LISTING = mcpListing({
  product: 'liveexample',
  description: 'Make examples on liveexample.app.',
  version: '1.2.3',
});

function buildServer(): McpServer {
  const server = new McpServer(serverIdentity(LISTING), { instructions: 'Use the tools.' });
  server.registerTool(
    'find_examples',
    { description: 'Finds examples.', inputSchema: { query: z.string() } },
    async () => ({ content: [{ type: 'text', text: 'none' }] }),
  );
  return server;
}

describe('mcpListing', () => {
  it('derives every address from the product', () => {
    expect(LISTING).toEqual({
      product: 'liveexample',
      registryName: 'io.github.livediagram-app/liveexample',
      title: 'liveexample',
      description: 'Make examples on liveexample.app.',
      version: '1.2.3',
      websiteUrl: 'https://www.liveexample.app',
      iconUrl: 'https://www.liveexample.app/liveexample-icon-512.png',
      documentationUrl: 'https://www.liveexample.app/help/account-and-data/connect-ai-mcp',
      remoteUrl: 'https://mcp.liveexample.app/mcp',
    });
  });

  it('gives initialize a serverInfo with title, website and icon', () => {
    expect(serverIdentity(LISTING)).toMatchObject({
      name: 'liveexample',
      title: 'liveexample',
      version: '1.2.3',
      websiteUrl: 'https://www.liveexample.app',
      icons: [{ src: 'https://www.liveexample.app/liveexample-icon-512.png' }],
    });
  });
});

describe('serverJsonProblems', () => {
  it('accepts the descriptor the listing makes', () => {
    expect(serverJsonProblems(registryDescriptor(LISTING), LISTING)).toEqual([]);
  });

  it("names a field copied from another product's descriptor", () => {
    const copied = { ...registryDescriptor(LISTING), name: 'io.github.liveother-app/liveexample' };
    expect(serverJsonProblems(copied, LISTING)).toEqual([
      expect.stringMatching(/^name: expected "io.github.livediagram-app\/liveexample"/),
    ]);
  });

  it('reports schema errors, and fields the listing does not have', () => {
    const problems = serverJsonProblems({ name: 'no slash', extra: true }, LISTING);
    expect(problems).toContain(
      'schema: /name must match pattern "^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$"',
    );
    expect(problems).toContain("schema: / must have required property 'version'");
    expect(problems).toContain('extra: expected undefined, found true');
  });

  it('reports a missing descriptor and an over-long description', () => {
    const long = mcpListing({
      product: 'liveexample',
      description: 'x'.repeat(101),
      version: '1.0.0',
    });
    const problems = serverJsonProblems(null, long);
    expect(problems).toContain('listing: description is over 100 characters');
    expect(problems.some((p) => p.startsWith('schema: / must be object'))).toBe(true);
  });
});

describe('serverCard', () => {
  it('lists the tools, instructions and sign-in a client needs before it connects', async () => {
    const card = await serverCard(LISTING, buildServer(), 'https://mcp.liveexample.app');
    expect(card).toMatchObject({
      serverInfo: { name: 'liveexample', title: 'liveexample', version: '1.2.3' },
      description: 'Make examples on liveexample.app.',
      registryName: 'io.github.livediagram-app/liveexample',
      transport: { type: 'streamable-http', endpoint: 'https://mcp.liveexample.app/mcp' },
      authentication: {
        required: true,
        schemes: ['oauth2'],
        resourceMetadata: 'https://mcp.liveexample.app/.well-known/oauth-protected-resource',
      },
      instructions: 'Use the tools.',
      tools: [{ name: 'find_examples', description: 'Finds examples.' }],
      resources: [],
      prompts: [],
    });
  });

  it('lists resources and prompts when the server has them', async () => {
    const server = buildServer();
    server.registerResource(
      'schema',
      'liveexample://schema',
      { mimeType: 'text/markdown' },
      async (uri) => ({
        contents: [{ uri: uri.href, text: '# Schema' }],
      }),
    );
    server.registerPrompt('show_my', { description: 'Shows mine.' }, () => ({ messages: [] }));
    const card = await serverCard(LISTING, server, 'http://localhost:1');
    expect(card).toMatchObject({
      resources: [{ name: 'schema', uri: 'liveexample://schema' }],
      prompts: [{ name: 'show_my' }],
    });
  });
});

describe('serverCard of an empty server', () => {
  it('lists no tools, resources or prompts', async () => {
    const card = await serverCard(
      LISTING,
      new McpServer(serverIdentity(LISTING)),
      'http://localhost:1',
    );
    expect(card).toMatchObject({ tools: [], resources: [], prompts: [] });
  });
});

describe('createMcpApp server card', () => {
  const app = createMcpApp<OauthEnv>({
    buildServer,
    oauth: { appBase: () => 'https://www.liveexample.app', builtInClients: {} },
    listing: LISTING,
  });

  it('answers without sign-in, cacheable, at the origin asked', async () => {
    const res = await app.request(`https://mcp.liveexample.app${SERVER_CARD_PATH}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    const card = (await res.json()) as { transport: { endpoint: string } };
    expect(card.transport.endpoint).toBe('https://mcp.liveexample.app/mcp');

    const again = await app.request(`https://mcp.liveexample.app${SERVER_CARD_PATH}`);
    expect(await again.json()).toEqual(card);
  });

  it('keeps a bounded cache of origins', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.request(`http://localhost:${9000 + i}${SERVER_CARD_PATH}`);
      const card = (await res.json()) as { transport: { endpoint: string } };
      expect(card.transport.endpoint).toBe(`http://localhost:${9000 + i}/mcp`);
    }
  });
});
