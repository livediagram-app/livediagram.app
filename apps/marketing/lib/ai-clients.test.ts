import { describe, expect, it } from 'vitest';

import {
  AI_CLIENT_GROUPS,
  AI_CLIENTS,
  MCP_URL,
  STARTER_PROMPTS,
  aiClientById,
  cursorInstallLink,
  vscodeInstallLink,
} from './ai-clients';

// docs/specs/019-marketing/build-with-ai.md "The clients".
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
      expect(aiClientById(section)).toBeUndefined();
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
        if (s.code?.lang === 'json') expect(() => JSON.parse(s.code!.code)).not.toThrow();
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
    const link = new URL(cursorInstallLink());
    expect(link.protocol).toBe('cursor:');
    expect(link.searchParams.get('name')).toBe('livediagram');
    expect(JSON.parse(atob(link.searchParams.get('config')!))).toEqual({ url: MCP_URL });
  });

  it("builds VS Code's URL handler with the encoded server JSON", () => {
    const link = vscodeInstallLink();
    expect(link.startsWith('vscode:mcp/install?')).toBe(true);
    expect(JSON.parse(decodeURIComponent(link.slice('vscode:mcp/install?'.length)))).toEqual({
      name: 'livediagram',
      type: 'http',
      url: MCP_URL,
    });
  });
});

describe('starter prompts', () => {
  it('name livediagram, so the AI picks the right tool', () => {
    expect(STARTER_PROMPTS.length).toBe(6);
    for (const p of STARTER_PROMPTS) expect(p.prompt).toMatch(/livediagram/);
  });
});
