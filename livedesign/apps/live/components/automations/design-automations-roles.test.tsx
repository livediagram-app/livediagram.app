// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "Share roles": the footer's Automations row is there for an Editor of the
// whole design and for nobody else; a guest Editor's opens Sign In, a design kept Offline's opens Sync Design.
import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationsToolsItem } from '@liveworkspace/automations-ui/automations-tools-item';
import { DesignAutomationsHost } from './DesignAutomationsHost';
import {
  useDesignAutomations,
  type DesignAutomations,
  type DesignAutomationsContext,
} from './use-design-automations';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

const sync = async () => {};
const tabs = [{ id: 't1', name: 'Logo' }];
const candidates: DesignAutomationsContext['commentMentions']['candidates'] = [];
const ctx = (over: Partial<DesignAutomationsContext> = {}): DesignAutomationsContext => ({
  can: { level: 'edit' },
  isStructureReadOnly: false,
  hydrated: true,
  embedMode: false,
  workbench: null,
  accountUserId: 'user_me',
  accountDisplayName: 'Me',
  authLoaded: true,
  selfParticipant: { id: 'user_me' },
  designId: 'd1',
  designName: 'Brand',
  tabs,
  activeId: 't1',
  sessionShareCode: null,
  sessionTabScope: null,
  syncToCloud: sync,
  commentMentions: { candidates },
  ...over,
});

const door = (c: DesignAutomationsContext, offline = false) =>
  renderHook(() => useDesignAutomations(c, offline, () => {})).result.current;

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
const withRow = (a: DesignAutomations) =>
  render(
    <DesignAutomationsHost {...a}>
      <Row />
    </DesignAutomationsHost>,
  );

describe('who sees Automations', () => {
  it('gives an Editor of the whole design the screen, and the row', () => {
    const a = door(ctx());
    expect(a.scope).toEqual({
      ownerId: 'user_me',
      itemId: 'd1',
      shareCode: null,
      as: 'user_me:edit',
    });
    expect(a.gate).toBeNull();
    withRow(a);
    expect(screen.getByRole('button', { name: 'Automations…' }).dataset['badges']).toBe('');
  });

  it.each([
    ['a one-tab link', ctx({ sessionTabScope: 't1', isStructureReadOnly: true })],
    ['a Participant', ctx({ can: { level: 'participate' } })],
    ['a Viewer', ctx({ can: { level: 'view' }, isStructureReadOnly: true })],
    ['an embed', ctx({ embedMode: true })],
    ['a workbench frame', ctx({ workbench: {} })],
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
    withRow(a);
    const row = screen.getByRole('button', { name: 'Automations…' });
    expect(row.dataset['badges']).toBe('Sign In');
    act(() => row.click());
    expect(await screen.findByRole('link', { name: 'Sign In' })).toBeTruthy();
  });

  it('asks a design kept Offline to sync first, and the row opens that gate', async () => {
    const a = door(ctx(), true);
    expect(a.scope).toBeNull();
    expect(a.gate).toMatchObject({ kind: 'sync', ready: true, badges: ['Sync Design'] });
    withRow(a);
    act(() => screen.getByRole('button', { name: 'Automations…' }).click());
    expect(await screen.findByRole('button', { name: 'Sync Design' })).toBeTruthy();
  });

  it('keeps the scope and the item the same object from render to render', () => {
    const c = ctx();
    const { result, rerender } = renderHook(
      ({ c: next }: { c: DesignAutomationsContext }) => useDesignAutomations(next, false, () => {}),
      { initialProps: { c } },
    );
    const first = result.current;
    // An edit: a new context object and a new tab list, the same ids and names.
    rerender({ c: { ...c, tabs: [{ id: 't1', name: 'Logo' }] } });
    expect(result.current.scope).toBe(first.scope);
    expect(result.current.item).toBe(first.item);
  });
});
