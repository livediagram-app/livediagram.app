import { describe, expect, it } from 'vitest';
import { automationsOfflineFor, automationsScopeFor } from './automations-gate';

// docs/specs/026-plan/automations.md "Who may do what": an Editor of the whole plan, on a plan saved to an account.
const SCOPE = { ownerId: 'me', projectId: 'p1', shareCode: null, tabId: null };
const EDITOR = {
  level: 'edit' as const,
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
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
    ['an embed', { embed: true }],
    ['a plan still loading', { hydrated: false }],
    ['no plan', { scope: null }],
  ])('stays shut for %s', (_, over) => {
    expect(automationsScopeFor({ ...EDITOR, ...over })).toBeNull();
  });
});

describe('automationsOfflineFor', () => {
  // A plan in Browser Storage has no rules, but its editor still sees the button (Rules Run on Our Servers).
  const OFFLINE = { ...EDITOR, offline: true };
  it('shows to whoever can edit a plan in Browser Storage', () => {
    expect(automationsOfflineFor(OFFLINE)).toBe(true);
  });
  it.each([
    ['a plan on the server', { offline: false }],
    ['a Participant', { level: 'participate' as const, structureReadOnly: true }],
    ['a Viewer', { level: 'view' as const, structureReadOnly: true }],
    ['a read-only structure', { structureReadOnly: true }],
    ['an embed', { embed: true }],
    ['a plan still loading', { hydrated: false }],
  ])('stays shut for %s', (_, over) => {
    expect(automationsOfflineFor({ ...OFFLINE, ...over })).toBe(false);
  });
});
