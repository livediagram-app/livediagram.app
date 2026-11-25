import { describe, expect, it } from 'vitest';

import {
  AI_CLIENT_GROUPS,
  CONNECTOR_NAME,
  aiClients,
  cursorInstallLink,
  tickedOf,
  vscodeInstallLink,
} from './ai-clients';

// docs/specs/019-marketing/build-with-ai.md "The clients", in each product. A product binds the list to its name
// and MCP address; any product will do here.
const MCP_URL = 'https://mcp.liveworkspace.app/mcp';
const AI_CLIENTS = aiClients({
  name: 'livediagram',
  mcpUrl: MCP_URL,
});
describe('Build with AI clients', () => {
  it('covers every client the spec names, in its group', () => {
    expect(AI_CLIENTS.map((c) => [c.id, c.group])).toEqual([
      ['claude', 'Chat apps'],
      ['chatgpt', 'Chat apps'],
      ['claude-code', 'Coding agents'],
      ['codex', 'Coding agents'],
      ['gemini', 'Coding agents'],
      ['cursor', 'Editors'],
      ['vscode', 'Editors'],
      ['windsurf', 'Editors'],
      ['other', 'Anything else'],
    ]);
  });

  it('gives each client a unique, hash-safe id and at least two steps', () => {
    const ids = AI_CLIENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of AI_CLIENTS) {
      expect(c.id).toMatch(/^[a-z][a-z-]*$/);
      expect(c.steps.length).toBeGreaterThanOrEqual(2);
      expect(AI_CLIENT_GROUPS).toContain(c.group);
    }
  });

  it('never ids a client after a page section, so its hash cannot clash', () => {
    for (const section of ['connect', 'prompts', 'how-it-works']) {
      expect(AI_CLIENTS.some((c) => c.id === section)).toBe(false);
    }
  });

  it('uses the one MCP address in every snippet that names one', () => {
    const snippets = AI_CLIENTS.flatMap((c) =>
      c.steps.flatMap((s) => (s.code ? [s.code.code] : [])),
    );
    const urls = snippets.flatMap((code) => code.match(/https:\/\/[^\s"]+/g) ?? []);
    expect(urls.length).toBeGreaterThanOrEqual(8);
    expect(new Set(urls)).toEqual(new Set([MCP_URL]));
  });

  it('writes valid JSON for every config snippet', () => {
    for (const c of AI_CLIENTS) {
      for (const s of c.steps) {
        if (s.code?.lang === 'json') expect(() => void JSON.parse(s.code!.code)).not.toThrow();
      }
    }
  });

  it('opens third-party pages in a new tab and keeps one-click installs in place', () => {
    const actions = AI_CLIENTS.flatMap((c) => c.steps.flatMap((s) => (s.action ? [s.action] : [])));
    for (const a of actions) {
      expect(a.external ?? false).toBe(a.href.startsWith('https://'));
    }
  });
});

describe('one-click install links', () => {
  it("builds Cursor's deeplink with the base64 mcp.json entry", () => {
    const link = new URL(cursorInstallLink(MCP_URL, 'livediagram'));
    expect(link.protocol).toBe('cursor:');
    expect(link.searchParams.get('name')).toBe('livediagram');
    expect(JSON.parse(atob(link.searchParams.get('config')!))).toEqual({ url: MCP_URL });
  });

  it("builds VS Code's URL handler with the encoded server JSON", () => {
    const link = vscodeInstallLink(MCP_URL, 'livediagram');
    expect(link.startsWith('vscode:mcp/install?')).toBe(true);
    expect(JSON.parse(decodeURIComponent(link.slice('vscode:mcp/install?'.length)))).toEqual({
      name: 'livediagram',
      type: 'http',
      url: MCP_URL,
    });
  });
});

describe('a product binding', () => {
  const text = (name: string) =>
    JSON.stringify(aiClients({ name, mcpUrl: 'https://mcp.liveworkspace.app/mcp' }));

  it('names the product only to say which app to keep ticked, never another product', () => {
    const planner = text('liveplanner');
    expect(planner).toContain('liveplanner ticked');
    expect(planner).not.toMatch(/running your own|your own MCP host/i);
    expect(planner).not.toMatch(/live(diagram|documents|design|knowledge)/);
  });

  it('adds the same connector on every product, so following two pages adds it once', () => {
    const commands = (name: string) =>
      aiClients({ name, mcpUrl: MCP_URL })
        .flatMap((c) => c.steps.flatMap((s) => (s.code ? [s.code.code] : [])))
        .join('\n')
        .replaceAll(name, '<product>');
    expect(CONNECTOR_NAME).toBe('liveworkspace');
    expect(commands('livediagram')).toContain(
      `claude mcp add --transport http --scope user ${CONNECTOR_NAME} `,
    );
    expect(commands('livedocuments')).toBe(
      commands('livediagram').replaceAll('livediagram', 'livedocuments'),
    );
    for (const product of [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'liveknowledge',
    ])
      expect(commands(product)).not.toContain('<product>');
  });
});

// liveworkspace/docs/specs/010-site/site.md "Build with AI": liveworkspace.app's page, for every app at once.
describe('the platform binding', () => {
  const platform = aiClients({
    name: 'liveworkspace',
    mcpUrl: MCP_URL,
    ticked: 'every app you want',
    cli: false,
  });
  const text = JSON.stringify(platform);

  it('says to keep every app wanted ticked, never one app or liveworkspace itself', () => {
    expect(text).toContain('with every app you want ticked');
    expect(text).not.toContain('liveworkspace ticked');
    expect(text).not.toMatch(/live(diagram|planner|documents|design|knowledge)/);
  });

  it('offers no CLI, since liveworkspace has none', () => {
    expect(platform.find((c) => c.id === 'claude-code')!.note).toBeUndefined();
    expect(text).not.toContain('CLI is another way in');
    expect(
      aiClients({ name: 'livediagram', mcpUrl: MCP_URL }).find((c) => c.id === 'claude-code')!.note,
    ).toContain('The livediagram CLI');
  });

  it('writes the same steps as a product, but for what is ticked', () => {
    const steps = (clients: readonly { steps: { code?: { code: string } }[] }[]) =>
      clients.flatMap((c) => c.steps.flatMap((s) => (s.code ? [s.code.code] : [])));
    expect(steps(platform)).toEqual(steps(aiClients({ name: 'livediagram', mcpUrl: MCP_URL })));
  });

  it('ticks the product by default', () => {
    expect(tickedOf({ name: 'livedesign', mcpUrl: MCP_URL })).toBe('livedesign');
    expect(tickedOf({ name: 'liveworkspace', mcpUrl: MCP_URL, ticked: 'every app you want' })).toBe(
      'every app you want',
    );
  });
});
