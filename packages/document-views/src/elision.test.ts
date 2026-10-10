import { describe, expect, it } from 'vitest';
import { elisionCommand } from './elision';

// The command an elision line names (docs/specs/024-agents/blueprints/document-views.md "Elision line").
describe('elisionCommand', () => {
  it('prints a safe value bare', () => {
    expect(elisionCommand({ only: 'c991' }, 'cli')).toBe('view --only c991');
    expect(elisionCommand({ budget: 1200, full: true }, 'cli')).toBe('view --budget 1200 --full');
  });

  it('single-quotes an id:"…" ref for the shell, so it pastes as one argument', () => {
    expect(elisionCommand({ only: 'id:"Node A"' }, 'cli')).toBe(`view --only 'id:"Node A"'`);
    expect(elisionCommand({ only: `id:"it's"` }, 'cli')).toBe(`view --only 'id:"it'\\''s"'`);
  });

  it('gives the MCP its JSON arguments as they are', () => {
    expect(elisionCommand({ only: 'id:"Node A"' }, 'mcp')).toBe(
      'read_document {"only":"id:\\"Node A\\""}',
    );
  });
});
