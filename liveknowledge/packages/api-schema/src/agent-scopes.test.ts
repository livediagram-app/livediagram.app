import { describe, expect, it } from 'vitest';
import { agentScopesFor, isAgentScope, parseAgentScopes } from './agent-scopes';

describe('agent scopes', () => {
  it('knows a scope by its name', () => {
    expect(isAgentScope('suggest')).toBe(true);
    expect(isAgentScope('admin')).toBe(false);
    expect(isAgentScope(1)).toBe(false);
  });

  it('reads a list in order, each once, always with read', () => {
    expect(parseAgentScopes(['write', 'write'])).toEqual(['read', 'write']);
    expect(parseAgentScopes([])).toEqual(['read']);
    expect(parseAgentScopes(['read', 'admin'])).toBeNull();
    expect(parseAgentScopes('read')).toBeNull();
  });

  it('gives a new connection read and suggest', () => {
    expect(agentScopesFor({ readOnly: false, role: 'edit' })).toEqual(['read', 'suggest']);
    expect(agentScopesFor({ readOnly: false, role: 'participate', granted: null })).toEqual([
      'read',
      'suggest',
    ]);
  });

  it('holds a read-only token and a Viewer’s agent to read, whatever was granted', () => {
    const granted = ['read', 'suggest', 'write'] as const;
    expect(agentScopesFor({ readOnly: true, role: 'edit', granted })).toEqual(['read']);
    expect(agentScopesFor({ readOnly: false, role: 'view', granted })).toEqual(['read']);
  });

  it('lets only an Editor’s agent hold write', () => {
    const granted = ['read', 'suggest', 'write'] as const;
    expect(agentScopesFor({ readOnly: false, role: 'edit', granted })).toEqual([
      'read',
      'suggest',
      'write',
    ]);
    expect(agentScopesFor({ readOnly: false, role: 'participate', granted })).toEqual([
      'read',
      'suggest',
    ]);
    expect(agentScopesFor({ readOnly: false, role: 'edit', granted: ['read'] })).toEqual(['read']);
  });
});
