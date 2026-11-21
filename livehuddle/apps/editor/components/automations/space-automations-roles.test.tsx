// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "Share roles": the footer's Automations row is there for an Editor of the
// whole Space and for nobody else; a guest Editor's opens Sign In, a Space kept Offline's opens Sync Space.
import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationsToolsItem } from '@liveworkspace/automations-ui/automations-tools-item';
import { SpaceAutomationsHost } from './SpaceAutomationsHost';
import {
  useSpaceAutomations,
  type SpaceAutomations,
  type SpaceAutomationsContext,
} from './use-space-automations';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

const sync = async () => {};
const tabs = [{ id: 't1', name: 'Meeting Room' }];
const teams = [{ id: 'team1', name: 'Studio' }];
const ctx = (over: Partial<SpaceAutomationsContext> = {}): SpaceAutomationsContext => ({
  can: { level: 'edit' },
  isStructureReadOnly: false,
  hydrated: true,
  embedMode: false,
  accountUserId: 'user_me',
  accountDisplayName: 'Me',
  authLoaded: true,
  selfParticipant: { id: 'user_me' },
  documentId: 'doc1',
  documentName: 'Studio Office',
  tabs,
  activeId: 't1',
  sessionShareCode: null,
  sessionTabScope: null,
  syncToCloud: sync,
  teams,
  documentTeamId: 'team1',
  ...over,
});

const door = (c: SpaceAutomationsContext, offline = false) =>
  renderHook(() => useSpaceAutomations(c, offline, () => {})).result.current;

function Row() {
  const item = useAutomationsToolsItem();
  return item ? (
    <button
      type="button"
      onClick={(e) => item.onSelect(e.currentTarget)}
      data-badges={(item.badges ?? []).join(',')}
    >
      {item.label}
    </button>
  ) : (
    <p>No row</p>
  );
}
const withRow = (a: SpaceAutomations) =>
  render(
    <SpaceAutomationsHost {...a}>
      <Row />
    </SpaceAutomationsHost>,
  );

describe('who sees Automations', () => {
  it('gives an Editor of the whole Space the screen, and the row', () => {
    const a = door(ctx());
    expect(a.scope).toEqual({ ownerId: 'user_me', itemId: 'doc1', shareCode: null });
    expect(a.gate).toBeNull();
    expect(a.item.team).toEqual({ ownerId: 'user_me', team: { id: 'team1', name: 'Studio' } });
    withRow(a);
    expect(screen.getByRole('button', { name: 'Automations…' }).dataset['badges']).toBe('');
  });

  it.each([
    ['a one-tab link', ctx({ sessionTabScope: 't1', isStructureReadOnly: true })],
    ['a Participant', ctx({ can: { level: 'participate' } })],
    ['a Viewer', ctx({ can: { level: 'view' }, isStructureReadOnly: true })],
    ['an embed', ctx({ embedMode: true })],
  ])('gives %s no row', (_, c) => {
    const a = door(c);
    expect(a.scope).toBeNull();
    expect(a.gate).toBeNull();
    withRow(a);
    expect(screen.getByText('No row')).toBeTruthy();
  });

  it('asks a guest Editor to sign in, and the row opens that gate', async () => {
    const a = door(
      ctx({ accountUserId: null, accountDisplayName: null, selfParticipant: { id: 'p1' } }),
    );
    expect(a.scope).toBeNull();
    expect(a.gate).toMatchObject({ kind: 'sign_in', badges: ['Sign In'] });
    // A guest has no team to read.
    expect(a.item.team).toBeNull();
    withRow(a);
    const row = screen.getByRole('button', { name: 'Automations…' });
    expect(row.dataset['badges']).toBe('Sign In');
    act(() => row.click());
    // The gate loads with its own chunk: a busy machine takes a moment over it.
    expect(await screen.findByRole('link', { name: 'Sign In' }, { timeout: 5000 })).toBeTruthy();
  });

  it('asks a Space kept Offline to sync first, and the row opens that gate', async () => {
    const a = door(ctx(), true);
    expect(a.scope).toBeNull();
    expect(a.gate).toMatchObject({ kind: 'sync', ready: true, badges: ['Sync Space'] });
    withRow(a);
    act(() => screen.getByRole('button', { name: 'Automations…' }).click());
    expect(
      await screen.findByRole('button', { name: 'Sync Space' }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  it('reads no team for a personal Space', () => {
    expect(door(ctx({ documentTeamId: null })).item.team).toBeNull();
    expect(door(ctx({ documentTeamId: 'team_gone' })).item.team).toBeNull();
  });

  it('keeps the scope and the item the same object from render to render', () => {
    const c = ctx();
    const { result, rerender } = renderHook(
      ({ c: next }: { c: SpaceAutomationsContext }) => useSpaceAutomations(next, false, () => {}),
      { initialProps: { c } },
    );
    const first = result.current;
    // An edit: a new context object, a new tab list and team list, the same ids and names.
    rerender({
      c: {
        ...c,
        tabs: [{ id: 't1', name: 'Meeting Room' }],
        teams: [{ id: 'team1', name: 'Studio' }],
      },
    });
    expect(result.current.scope).toBe(first.scope);
    expect(result.current.item).toBe(first.item);
  });
});
