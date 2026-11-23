import { describe, expect, it } from 'vitest';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { askRights } from './ask-rights';

const session = (level: 'edit' | 'participate' | 'view', over = {}) =>
  askRights({
    can: resolveEditorCapabilities(level),
    isStructureReadOnly: level !== 'edit',
    accountUserId: 'me',
    offline: false,
    ...over,
  });

// docs/specs/030-knowledgebase/search-and-ask.md "Share roles", ai-knowledge.md "Share roles".
describe('who may do what in Ask and Insights', () => {
  it('lets an Editor ask and do everything else', () => {
    expect(session('edit')).toEqual({
      askOff: null,
      manageAi: true,
      makePages: true,
      resolve: true,
      acceptSuggestions: true,
      context: true,
      grantAgents: true,
      emailOwners: true,
    });
  });

  it.each(['participate', 'view'] as const)('lets a %s session ask and change nothing', (level) => {
    expect(session(level)).toEqual({
      askOff: null,
      manageAi: false,
      makePages: false,
      resolve: false,
      acceptSuggestions: false,
      context: false,
      grantAgents: false,
      emailOwners: false,
    });
  });

  it('keeps accepting and dismissing a suggested edit for an Editor (Work Tracker 1362)', () => {
    const participant = session('participate', { isStructureReadOnly: false });
    expect(participant.resolve).toBe(true);
    expect(participant.acceptSuggestions).toBe(false);
    expect(session('edit').acceptSuggestions).toBe(true);
  });

  it('turns Ask off for anyone not signed in, whatever their role', () => {
    expect(session('edit', { accountUserId: null }).askOff).toBe('signed-out');
    expect(session('view', { accountUserId: undefined }).askOff).toBe('signed-out');
  });

  it('gives a knowledgebase kept Offline no Ask and no Editor actions', () => {
    expect(session('edit', { offline: true })).toEqual({
      askOff: 'offline',
      manageAi: false,
      makePages: false,
      resolve: false,
      acceptSuggestions: false,
      context: false,
      grantAgents: false,
      emailOwners: false,
    });
  });

  it('gives an Editor through a link confined to one page no Editor actions', () => {
    expect(session('edit', { isStructureReadOnly: true }).manageAi).toBe(false);
    // A guest who may edit emails nobody: the owners are told an Editor asked.
    expect(session('edit', { accountUserId: null }).emailOwners).toBe(false);
  });
});
