import { describe, expect, it } from 'vitest';
import { automationsGateFor, automationsScopeFor } from './automations-gate';

// docs/specs/026-plan/automations.md "Who may do what": an Editor of the whole plan, on a plan saved to an account.
const SCOPE = { ownerId: 'me', projectId: 'p1', shareCode: null, tabId: null };
const EDITOR = {
  level: 'edit' as const,
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
  signedIn: true,
  authLoaded: true,
  scope: SCOPE,
};

describe('automationsScopeFor', () => {
  it('opens for an Editor of the whole plan saved to an account', () => {
    expect(automationsScopeFor(EDITOR)).toEqual({
      ownerId: 'me',
      projectId: 'p1',
      shareCode: null,
    });
    expect(automationsScopeFor({ ...EDITOR, scope: { ...SCOPE, shareCode: 'abc' } })).toEqual({
      ownerId: 'me',
      projectId: 'p1',
      shareCode: 'abc',
    });
  });

  it.each([
    ['a Participant', { level: 'participate' as const, structureReadOnly: true }],
    ['a Viewer', { level: 'view' as const, structureReadOnly: true }],
    ['a tab-scoped Editor link', { structureReadOnly: true, scope: { ...SCOPE, tabId: 't1' } }],
    ['a tab-scoped scope alone', { scope: { ...SCOPE, tabId: 't1' } }],
    ['a plan in Browser Storage', { offline: true }],
    ['a guest', { signedIn: false }],
    ['an embed', { embed: true }],
    ['a plan still loading', { hydrated: false }],
    ['no plan', { scope: null }],
  ])('stays shut for %s', (_, over) => {
    expect(automationsScopeFor({ ...EDITOR, ...over })).toBeNull();
  });
});

describe('automationsGateFor', () => {
  it('asks a plan in This Browser to sync, a guest to sign in, and a signed-in Editor nothing', () => {
    expect(automationsGateFor({ ...EDITOR, offline: true })).toBe('sync');
    expect(automationsGateFor({ ...EDITOR, offline: true, scope: null })).toBe('sync');
    expect(automationsGateFor({ ...EDITOR, offline: true, signedIn: false })).toBe('sync');
    expect(automationsGateFor({ ...EDITOR, signedIn: false })).toBe('sign_in');
    expect(automationsGateFor(EDITOR)).toBeNull();
  });
  it.each([
    ['sign-in not answered yet', { signedIn: false, authLoaded: false }],
    ['a guest with no plan scope', { signedIn: false, scope: null }],
    ['a Participant', { level: 'participate' as const, structureReadOnly: true, offline: true }],
    ['a Viewer', { level: 'view' as const, structureReadOnly: true, signedIn: false }],
    ['a tab-scoped link', { signedIn: false, scope: { ...SCOPE, tabId: 't1' } }],
    ['an embed', { embed: true, offline: true }],
    ['a plan still loading', { hydrated: false, offline: true }],
  ])('stays shut for %s', (_, over) => {
    expect(automationsGateFor({ ...EDITOR, ...over })).toBeNull();
  });
});
