// @vitest-environment jsdom

// The meta row and the rail over the editor's store (docs/specs/030-knowledgebase/verification.md): Page Health is
// read once when a page opens, a typing commit renders nothing and reads nothing, Verify is optimistic and rolls
// back with a toast, and each share role is offered what it may do.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import type { Tab } from '@liveknowledge/document';
import {
  createEditorChromeStore,
  EditorChromeContext,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

const api = vi.hoisted(() => ({
  apiPageHealth: vi.fn(),
  apiVerifyPage: vi.fn(),
  apiSetPageKnowledge: vi.fn(),
}));
vi.mock('@/lib/api/knowledge', () => ({ ...api, ContextBudgetError: class extends Error {} }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { PageMetaRow } from './PageMetaRow';
import { PageRailBody } from './PageRail';

const para = (id: string, style: string, text: string) =>
  ({ id, type: 'paragraph', style, runs: [{ text }] }) as never;
const page = (id: string, body: string): Tab => ({
  id,
  name: id,
  elements: [],
  articles: {
    'art-1': {
      blocks: [
        para('t', 'title', 'Release'),
        para('h', 'h1', 'Tag the Build'),
        para('b', 'body', body),
      ],
    },
  },
});

let n = 0;
function mount(level: AccessLevel, accountUserId: string | null = 'u1') {
  const documentId = `d${++n}`;
  // A page's id is its own in every knowledgebase, so each mount has its own (the store is the session's).
  const pageId = `p${n}`;
  const tabs = [page(pageId, 'Words'), page('other', 'More')];
  const fields: Record<string, unknown> = {
    documentId,
    tabs,
    activeId: pageId,
    activeTab: tabs[0],
    can: resolveEditorCapabilities(level),
    isStructureReadOnly: level !== 'edit',
    // A plain editor session: not an embed, a workbench or a Community visit.
    hydrated: true,
    embedMode: false,
    workbench: false,
    sessionCommunity: false,
    accountUserId,
    selfParticipant: { id: accountUserId ?? 'guest_1', name: 'Priya Nair' },
    sessionShareCode: null,
    commentMentions: { candidates: [] },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  const valueOf = (over: Record<string, unknown> = {}) =>
    new Proxy(
      { ...fields, ...over },
      { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
    ) as unknown as EditorContextValue;
  const store = createEditorChromeStore(valueOf());
  const renders = { meta: 0, rail: 0 };
  render(
    <EditorChromeContext.Provider value={store}>
      <Profiler id="meta" onRender={() => renders.meta++}>
        <PageMetaRow />
      </Profiler>
      <Profiler id="rail" onRender={() => renders.rail++}>
        <PageRailBody />
      </Profiler>
    </EditorChromeContext.Provider>,
  );
  return { store, valueOf, renders, documentId, pageId, tabs };
}

const health = (over: object = {}) => ({
  knowledge: {
    tab: 'p1',
    state: 'never-verified',
    changedSinceVerified: false,
    tokens: 10,
    ...over,
  },
  reads: { people: 3, agents: 7 },
});

beforeEach(() => {
  api.apiPageHealth.mockResolvedValue(health());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('a page’s knowledge in the editor', () => {
  it('reads Page Health once when the page opens, counting the open, and shows the reads', async () => {
    const { documentId, pageId } = mount('view');
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    expect(screen.getByText('7')).toBeTruthy();
    expect(api.apiPageHealth).toHaveBeenCalledTimes(1);
    expect(api.apiPageHealth.mock.calls[0]!.slice(1)).toEqual([
      documentId,
      pageId,
      undefined,
      true,
    ]);
    expect(screen.getByRole('button', { name: 'Tag the Build' })).toBeTruthy();
  });

  it('a typing commit renders neither and reads nothing; a new heading renders the rail alone', async () => {
    const { store, valueOf, renders, pageId } = mount('edit');
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    renders.meta = 0;
    renders.rail = 0;
    // A commit of body text: a new tab and block list, the same headings and fields.
    act(() => store.set(valueOf({ activeTab: page(pageId, 'Words typed') })));
    expect(renders).toEqual({ meta: 0, rail: 0 });
    expect(api.apiPageHealth).toHaveBeenCalledTimes(1);
    const next = page(pageId, 'Words');
    (next.articles!['art-1'] as unknown as { blocks: unknown[] }).blocks.push(
      para('h2', 'h2', 'Ship It'),
    );
    act(() => store.set(valueOf({ activeTab: next })));
    expect(renders.meta).toBe(0);
    expect(renders.rail).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ship It' })).toBeTruthy();
  });

  it('the Health Score shows with Page Health, from what the editor holds; a fix only for those who may', async () => {
    for (const [level, fixes] of [
      ['view', 0],
      ['edit', 2],
    ] as const) {
      api.apiPageHealth.mockResolvedValue({
        ...health(),
        signals: { openConflicts: 1, openThreads: 0, suggestions: 0, backlinks: 0 },
      });
      mount(level);
      await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
      const score = document.querySelector('[data-health-score]')!;
      expect(score.getAttribute('data-health-score')).toBe('needs-work');
      fireEvent.click(
        within(score as HTMLElement).getByRole('button', { name: 'Score Breakdown' }),
      );
      expect(within(score as HTMLElement).getByText('Resolve the conflict: +5')).toBeTruthy();
      expect(
        within(score as HTMLElement).queryAllByRole('button', { name: 'Verify' }),
      ).toHaveLength(fixes);
      cleanup();
    }
  });

  const rail = () => document.querySelector<HTMLElement>('[data-page-health]')!;
  const railButton = (name: string) => within(rail()).getByRole('button', { name });

  it('an Editor verifies in one press, shown at once', async () => {
    let answer!: (value: unknown) => void;
    api.apiVerifyPage.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    mount('edit');
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    // The rail's Verify is one press (the meta row's asks first, VerifyPageButton.test.tsx).
    fireEvent.click(railButton('Verify'));
    // Before the server answers.
    expect(screen.getByText('Verified by Priya Nair')).toBeTruthy();
    expect(within(rail()).getAllByRole('button', { name: 'Verify Again' })).toHaveLength(1);
    await act(async () => {
      answer({
        tab: 'p1',
        state: 'verified',
        owner: 'u1',
        verifiedBy: 'u1',
        verifiedAt: Date.now(),
        changedSinceVerified: false,
        tokens: 10,
      });
    });
    expect(screen.getByText('Verified by Priya Nair')).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rolls a refused Verify back and says why', async () => {
    api.apiVerifyPage.mockRejectedValue(new Error('down'));
    mount('edit');
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    fireEvent.click(railButton('Verify'));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('The page could not be verified. Try again.'),
    );
    expect(screen.queryByText(/^Verified/)).toBeNull();
    expect(within(rail()).getAllByRole('button', { name: 'Verify' })).toHaveLength(1);
  });

  it('shows the due date under the knowledgebase’s Review Period, and follows a change of it at once', async () => {
    const verifiedAt = Date.now() - 40 * 86_400_000;
    const { documentId, pageId, store, valueOf, tabs } = mount('edit');
    const verified = [{ ...tabs[0]!, knowledge: { verifiedAt, verifiedBy: 'u1' } }, tabs[1]!];
    act(() => store.set(valueOf({ tabs: verified, activeTab: verified[0] })));
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    const rail = () => document.querySelector('[data-page-health]')!;
    const shown = () => [
      rail().querySelector('[data-review-due]')?.textContent ?? null,
      rail().querySelector('[data-review-period]')!.textContent,
    ];
    expect(shown()[1]).toBe('Every 90 Days');
    // The amber pill, apart from Page Health's own "Review Due" label and headline.
    const pill = () =>
      screen.queryAllByText('Review Due').filter((el) => !el.closest('[data-page-health]'));
    expect(screen.getByText(/^Review due /)).toBeTruthy();
    expect(pill()).toHaveLength(0);
    // The room's op (or this editor's own change): one store, every reader follows.
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 30 }));
    expect(shown()[1]).toBe('Every 30 Days');
    expect(screen.getByText(/^Review was due /)).toBeTruthy();
    expect(pill()).toHaveLength(1);
    // Never turns verification off: no Review Due, no Verify; the period reads Never.
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 'never' }));
    expect(shown()).toEqual([null, 'Never']);
    expect(within(rail() as HTMLElement).queryByRole('button', { name: /^Verify/ })).toBeNull();
    // A period set again brings it all back from the stored date.
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 90 }));
    expect(shown()[1]).toBe('Every 90 Days');
    expect(shown()[0]).not.toBeNull();
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 'never' }));
    expect(screen.queryByText(/^Review (was )?due /)).toBeNull();
    expect(pill()).toHaveLength(0);
    // No request a change, and no page written.
    expect(api.apiSetPageKnowledge).not.toHaveBeenCalled();
    expect(pageId).toBeTruthy();
  });

  it('Page Health shows the Review Period to everyone, and the pencil beside it to an Editor alone', async () => {
    for (const [level, offered] of [
      ['edit', true],
      ['participate', false],
      ['view', false],
    ] as const) {
      mount(level);
      await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
      const change = screen.queryByRole('button', { name: 'Change Review Period' });
      expect(!!change).toBe(offered);
      // Beside the value, in the Review Period's own row.
      if (change) expect(change.closest('dd')!.querySelector('[data-review-period]')).toBeTruthy();
      expect(screen.getByText('Every 90 Days')).toBeTruthy();
      cleanup();
    }
  });

  it.each(['participate', 'view'] as const)(
    'a %s session reads and changes nothing',
    async (level) => {
      mount(level);
      await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
      expect(screen.queryByRole('button', { name: /Verify/ })).toBeNull();
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.getByText('Nobody')).toBeTruthy();
    },
  );

  it('a guest Editor (no account) verifies too, and still sets the fields', async () => {
    mount('edit', null);
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    expect(within(rail()).getByRole('button', { name: 'Verify' })).toBeTruthy();
    // The owner is theirs to set, and so is the knowledgebase's Review Period.
    expect(screen.getByLabelText('Owner')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Review Period' })).toBeTruthy();
  });
});
