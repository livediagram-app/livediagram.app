// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECT_APP_KEY, connectApps, keepConnectApp, keptConnectApp } from './connect-apps';

const URL = 'https://mcp.example.test/mcp';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// docs/specs/030-knowledgebase/mcp-connect.md "The view" 1 and 2.
describe('the apps', () => {
  it('are the six, in order, the last named Other App', () => {
    expect(connectApps(URL).map((app) => app.name)).toEqual([
      'Claude',
      'Claude Code',
      'ChatGPT',
      'Cursor',
      'VS Code',
      'Other App',
    ]);
  });

  it('each name this deployment’s address in a step, and none the hosted one', () => {
    for (const app of connectApps(URL)) {
      const words = JSON.stringify(app.steps);
      expect(words.includes(URL) || words.includes(encodeURIComponent(URL)), app.id).toBe(true);
      expect(words).not.toContain('mcp.liveknowledge.app');
    }
  });

  it('gives Claude Code its command', () => {
    const code = connectApps(URL).find((app) => app.id === 'claude-code')!;
    expect(code.steps[0]!.code!.code).toBe(
      `claude mcp add --transport http --scope user liveknowledge ${URL}`,
    );
  });
});

describe('the pick', () => {
  it('is kept in this browser, and is Claude when none is or the value is unknown', () => {
    expect(keptConnectApp()).toBe('claude');
    keepConnectApp('cursor');
    expect(localStorage.getItem(CONNECT_APP_KEY)).toBe('cursor');
    expect(keptConnectApp()).toBe('cursor');
    localStorage.setItem(CONNECT_APP_KEY, 'netscape');
    expect(keptConnectApp()).toBe('claude');
  });

  it('is Claude, and the view goes on, when the store throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(keptConnectApp()).toBe('claude');
    expect(() => keepConnectApp('vscode')).not.toThrow();
  });
});
