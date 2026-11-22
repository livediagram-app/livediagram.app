// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "Share roles": the footer's Automations row is there for an Editor of the
// whole document and for nobody else; a guest Editor's opens Sign In, a knowledgebase kept Offline's opens Sync Knowledgebase.
import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationsToolsItem } from '@liveworkspace/automations-ui/automations-tools-item';
import { DocumentAutomationsHost } from './DocumentAutomationsHost';
import {
  useDocumentAutomations,
  type DocumentAutomations,
  type DocumentAutomationsContext,
} from './use-document-automations';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ rules: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

const sync = async () => {};
const tabs = [{ id: 't1', name: 'Letter' }];
const candidates: DocumentAutomationsContext['commentMentions']['candidates'] = [];
const ctx = (over: Partial<DocumentAutomationsContext> = {}): DocumentAutomationsContext => ({
  can: { level: 'edit' },
  isStructureReadOnly: false,
  hydrated: true,
  embedMode: false,
  workbench: null,
  accountUserId: 'user_me',
  accountDisplayName: 'Me',
  authLoaded: true,
  selfParticipant: { id: 'user_me' },
  documentId: 'doc1',
  documentName: 'Handbook',
  tabs,
  activeId: 't1',
  sessionShareCode: null,
  sessionTabScope: null,
  syncToCloud: sync,
  commentMentions: { candidates },
  ...over,
});

const door = (c: DocumentAutomationsContext, offline = false) =>
  renderHook(() => useDocumentAutomations(c, offline, () => {})).result.current;

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
const withRow = (a: DocumentAutomations) =>
  render(
    <DocumentAutomationsHost {...a}>
      <Row />
    </DocumentAutomationsHost>,
  );

describe('who sees Automations', () => {
  it('gives an Editor of the whole document the screen, and the row', () => {
    const a = door(ctx());
    expect(a.scope).toEqual({
      ownerId: 'user_me',
      itemId: 'doc1',
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

  it('asks a document kept Offline to sync first, and the row opens that gate', async () => {
    const a = door(ctx(), true);
    expect(a.scope).toBeNull();
    expect(a.gate).toMatchObject({ kind: 'sync', ready: true, badges: ['Sync Knowledgebase'] });
    withRow(a);
    act(() => screen.getByRole('button', { name: 'Automations…' }).click());
    expect(await screen.findByRole('button', { name: 'Sync Knowledgebase' })).toBeTruthy();
  });

  it('keeps the scope and the item the same object from render to render', () => {
    const c = ctx();
    const { result, rerender } = renderHook(
      ({ c: next }: { c: DocumentAutomationsContext }) =>
        useDocumentAutomations(next, false, () => {}),
      { initialProps: { c } },
    );
    const first = result.current;
    // An edit: a new context object and a new tab list, the same ids and names.
    rerender({ c: { ...c, tabs: [{ id: 't1', name: 'Letter' }] } });
    expect(result.current.scope).toBe(first.scope);
    expect(result.current.item).toBe(first.item);
  });
});
