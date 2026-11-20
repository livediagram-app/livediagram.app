// @vitest-environment jsdom

// Knowledgebase Settings in the editor (docs/specs/030-knowledgebase/verification.md "The Review Period"): who is
// offered it, the five rows, what a shorter period asks before it applies, and the one optimistic change with its
// undo and its rollback.
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '@liveknowledge/document';
import { EditorChromeContext, type EditorChromeStore } from '@/app/document/[id]/EditorContext';

const api = vi.hoisted(() => ({ apiSetReviewPeriod: vi.fn(), apiPreviewReviewPeriod: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
const offlineStore = vi.hoisted(() => ({ offlineSaveDocumentMeta: vi.fn(async () => {}) }));
vi.mock('@/lib/offline/offline-store', () => offlineStore);
const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));

import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { chromeValue, page, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { buildEditorCommands } from '@/lib/editor-commands';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import {
  closeKnowledgeSettings,
  isKnowledgeSettingsOpen,
  openKnowledgeSettings,
  usePublishedKnowledgeSettingsOffered,
} from '@/lib/knowledge-settings/settings-open';
import { track } from '@/lib/telemetry';
import { KnowledgeSettingsDialog } from './KnowledgeSettingsDialog';
import {
  KnowledgeSettingsWhenOpen,
  openKnowledgebaseSettings,
  useKnowledgebaseSettings,
} from './KnowledgeSettingsHost';
import { settingsOfferedOf, useSettingsOffered } from './useSettingsOffered';

const DAY = 86_400_000;
let n = 0;
/** A knowledgebase of its own for each test: the settings store is the session's. */
function kb(role: Role = 'edit', over: Record<string, unknown> = {}) {
  const documentId = `kb-${++n}`;
  const tabs = [
    { ...page('p1', 'Deploys'), knowledge: { verifiedAt: Date.now() - 100 * DAY } },
    { ...page('p2', 'Rollbacks'), knowledge: { verifiedAt: Date.now() - 40 * DAY } },
    page('p3', 'Holidays'),
  ];
  return { documentId, value: chromeValue(role, { documentId, tabs, ...over }) };
}
const rows = () => screen.getAllByRole('radio');
const row = (name: string) => screen.getByRole('radio', { name });
const chosen = () => rows().find((r) => r.getAttribute('aria-checked') === 'true')?.textContent;
const ask = () => document.querySelector('[data-review-period-ask]')!;
const preview = (reviewDue: number, reviewDueNow: number) =>
  api.apiPreviewReviewPeriod.mockResolvedValue({ reviewEvery: 30, reviewDue, reviewDueNow });

beforeEach(() => {
  offline.value = false;
  api.apiSetReviewPeriod.mockImplementation(async (_who, _id, every: unknown) => every);
  preview(12, 3);
});
afterEach(() => {
  cleanup();
  closeKnowledgeSettings();
  vi.clearAllMocks();
});

describe('who is offered Knowledgebase Settings', () => {
  it.each([
    ['edit', true],
    ['participate', false],
    ['view', false],
  ] as const)('a %s session: %s', (role, offered) => {
    const wrapper = (store: EditorChromeStore) =>
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <EditorChromeContext.Provider value={store}>{children}</EditorChromeContext.Provider>
        );
      };
    const { store } = renderInEditor(<KnowledgeSettingsWhenOpen />, kb(role).value);
    expect(renderHook(() => useSettingsOffered(), { wrapper: wrapper(store) }).result.current).toBe(
      offered,
    );
    const menu = renderHook(() => useKnowledgebaseSettings(), { wrapper: wrapper(store) }).result
      .current;
    expect(menu?.label ?? null).toBe(offered ? 'Knowledgebase Settings' : null);
    // The palette lists the command from what the host publishes.
    expect(renderHook(() => usePublishedKnowledgeSettingsOffered()).result.current).toBe(offered);
    // Opened anyway (a stale shortcut), it is drawn for an Editor only.
    act(() => openKnowledgeSettings());
    expect(isKnowledgeSettingsOpen()).toBe(offered);
  });

  it('is not offered in an embed, a workbench, a Community visit, a locked structure or before a knowledgebase is open', () => {
    const base = kb().value;
    expect(settingsOfferedOf(base)).toBe(true);
    for (const over of [
      { embedMode: true },
      { workbench: {} },
      { sessionCommunity: {} },
      { isStructureReadOnly: true },
      { hydrated: false },
      { documentId: null },
    ])
      expect(settingsOfferedOf({ ...base, ...over } as never)).toBe(false);
  });

  it('has no opener without an editor around it', () => {
    expect(renderHook(() => useKnowledgebaseSettings()).result.current).toBeNull();
  });

  it('is a command of the palette for an Editor, and opens the dialog', () => {
    const context = { isReadOnly: false, canvasTool: 'select' } as never;
    const handlers = new Proxy({}, { get: () => () => {} }) as never;
    const names = (over: object) =>
      buildEditorCommands({ ...(context as object), ...over } as never, handlers).map(
        (c) => c.name,
      );
    expect(names({})).not.toContain('Knowledgebase Settings');
    const commands = buildEditorCommands(
      { ...(context as object), canOpenKnowledgeSettings: true } as never,
      handlers,
    );
    const command = commands.find((c) => c.name === 'Knowledgebase Settings')!;
    expect(command.keywords).toContain('review period');
    command.run();
    expect(isKnowledgeSettingsOpen()).toBe(true);
  });

  it('counts an open from Page Health or the menu', () => {
    openKnowledgebaseSettings();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'KnowledgebaseSettings');
    expect(isKnowledgeSettingsOpen()).toBe(true);
  });
});

describe('the dialog', () => {
  it('is titled Knowledgebase Settings, with Reviews, the five rows and the line that says what they do', () => {
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, kb().value);
    expect(screen.getByRole('dialog', { name: 'Knowledgebase Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'Review Period' });
    expect(group.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      screen.getByText('A verified page comes due for review this long after it was last verified.')
        .id,
    ).toBe(group.getAttribute('aria-describedby'));
    expect(rows().map((r) => r.textContent)).toEqual([
      'Every 30 Days',
      'Every 90 Days',
      'Every 180 Days',
      'Every Year',
      'Never',
    ]);
    expect(chosen()).toBe('Every 90 Days');
    // One stop in the tab order, on the chosen row; arrows move within the group.
    expect(
      rows()
        .filter((r) => r.tabIndex === 0)
        .map((r) => r.textContent),
    ).toEqual(['Every 90 Days']);
    row('Every 90 Days').focus();
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Every 180 Days');
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toBe('Every 30 Days');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(document.activeElement?.textContent).toBe('Never');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(document.activeElement?.textContent).toBe('Every 30 Days');
    fireEvent.keyDown(group, { key: 'a' });
    expect(document.activeElement?.textContent).toBe('Every 30 Days');
  });

  it('applies a longer period at once: shown, stored, said in a toast that can undo it', async () => {
    const { documentId, value } = kb();
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, value);
    fireEvent.click(row('Every Year'));
    // At once, before the server answers, with no question.
    expect(chosen()).toBe('Every Year');
    expect(ask().getAttribute('data-review-period-ask')).toBe('');
    expect(api.apiPreviewReviewPeriod).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'ReviewPeriodChanged');
    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1));
    expect(api.apiSetReviewPeriod).toHaveBeenCalledWith(
      { ownerId: 'me', shareCode: null },
      documentId,
      365,
    );
    const [message, options] = toast.info.mock.calls[0]! as [
      string,
      { action: { label: string; onSelect: () => void } },
    ];
    expect(message).toBe('Pages are now reviewed every year.');
    // One undoable edit: Undo puts back the period it replaced, and its own toast offers no further undo.
    expect(options.action.label).toBe('Undo');
    act(() => options.action.onSelect());
    expect(chosen()).toBe('Every 90 Days');
    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(2));
    expect(api.apiSetReviewPeriod).toHaveBeenLastCalledWith(expect.anything(), documentId, 90);
    expect(toast.info.mock.calls[1]).toEqual(['Pages are now reviewed every 90 days.', undefined]);
  });

  it('does nothing for the period already chosen', () => {
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, kb().value);
    fireEvent.click(row('Every 90 Days'));
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
    expect(api.apiPreviewReviewPeriod).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('says how many pages a shorter period makes due before it applies, with Apply and Cancel', async () => {
    const { documentId, value } = kb();
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, value);
    fireEvent.click(row('Every 30 Days'));
    // Counting: nothing is applied, the chosen period stands, and Apply waits for the count.
    expect(chosen()).toBe('Every 90 Days');
    expect(ask().getAttribute('data-review-period-ask')).toBe('30');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Apply' }).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText('12 pages will be due for review')).toBeTruthy());
    expect(api.apiPreviewReviewPeriod).toHaveBeenCalledWith(
      { ownerId: 'me', shareCode: null },
      documentId,
      30,
      expect.anything(),
    );
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
    expect(knowledgeSettingsStore.reviewEveryOf(documentId)).toBe(90);
    // Cancel leaves everything as it was.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(ask().getAttribute('data-review-period-ask')).toBe('');
    expect(chosen()).toBe('Every 90 Days');
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
    // Apply applies it.
    fireEvent.click(row('Every 30 Days'));
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Apply' }).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(chosen()).toBe('Every 30 Days');
    expect(ask().getAttribute('data-review-period-ask')).toBe('');
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Pages are now reviewed every 30 days.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
      ),
    );
    expect(api.apiSetReviewPeriod).toHaveBeenCalledWith(expect.anything(), documentId, 30);
  });

  it('applies a shorter period at once when it makes no more pages due', async () => {
    preview(3, 3);
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, kb().value);
    fireEvent.click(row('Every 30 Days'));
    await waitFor(() => expect(chosen()).toBe('Every 30 Days'));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(api.apiSetReviewPeriod).toHaveBeenCalledTimes(1);
  });

  it('drops a count that a newer pick overtook', async () => {
    let answer: (count: object) => void = () => {};
    api.apiPreviewReviewPeriod.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, kb().value);
    fireEvent.click(row('Every 30 Days'));
    fireEvent.click(row('Every Year'));
    await act(async () => answer({ reviewEvery: 30, reviewDue: 40, reviewDueNow: 1 }));
    expect(chosen()).toBe('Every Year');
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it.each([
    [new ApiError('set review period', 403, 'forbidden'), 'Only an Editor can change'],
    [new Error('down'), 'so it is back as it was'],
  ])(
    'puts the period back and says why in words when the change is refused',
    async (err, words) => {
      api.apiSetReviewPeriod.mockRejectedValue(err);
      const { documentId, value } = kb();
      renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, value);
      fireEvent.click(row('Never'));
      expect(chosen()).toBe('Never');
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error.mock.calls[0]![0]).toContain(words);
      expect(toast.error.mock.calls[0]![0]).not.toMatch(/403|forbidden/);
      expect(chosen()).toBe('Every 90 Days');
      expect(knowledgeSettingsStore.reviewEveryOf(documentId)).toBe(90);
      expect(toast.info).not.toHaveBeenCalled();
    },
  );

  it('follows a change made by someone else while it is open', () => {
    const { documentId, value } = kb();
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, value);
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 180 }));
    expect(chosen()).toBe('Every 180 Days');
  });

  it('counts from the pages it holds and writes the record, for a knowledgebase kept Offline', async () => {
    offline.value = true;
    const { documentId, value } = kb();
    renderInEditor(<KnowledgeSettingsDialog onClose={() => {}} />, value);
    fireEvent.click(row('Every 30 Days'));
    // Two of its pages are past 30 days, one past 90.
    await waitFor(() => expect(screen.getByText('2 pages will be due for review')).toBeTruthy());
    expect(api.apiPreviewReviewPeriod).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(offlineStore.offlineSaveDocumentMeta).toHaveBeenCalledWith(
      documentId,
      { knowledgeSettings: { reviewEvery: 30 } },
      expect.any(Number),
    );
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
  });

  it('keeps one height, with room for the question always there, and closes from Done', () => {
    const onClose = vi.fn();
    renderInEditor(<KnowledgeSettingsDialog onClose={onClose} />, kb().value);
    const body = document.querySelector('[data-knowledge-settings]')!;
    expect(body.className).toContain('h-[29rem]');
    expect(ask().className).toContain('min-h-14');
    expect(ask().getAttribute('aria-live')).toBe('polite');
    expect(ask().textContent).toContain('No page is rewritten.');
    for (const r of rows()) {
      expect(r.className).toContain('min-h-11');
      expect(r.className).toContain('cursor-pointer');
      expect(r.className).toContain('focus-visible:outline-2');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is over 4.5:1 where it sets text on a colour, in light and in dark', () => {
    const theme = readFileSync(resolve('../../packages/tailwind-config/theme.css'), 'utf8');
    const brand = (step: number) =>
      new RegExp(`--color-brand-${step}:\\s*(#[0-9a-fA-F]{6})`).exec(theme)![1]!;
    const slate = { 100: '#f1f5f9', 400: '#94a3b8', 600: '#475569', 900: '#0f172a' };
    // The tick: white on brand-700, and on brand-600 in dark.
    expect(contrastRatio('#ffffff', brand(700))).toBeGreaterThan(4.5);
    expect(contrastRatio('#ffffff', brand(600))).toBeGreaterThan(4.5);
    // The chosen row's label on its tint; a resting row's on white and on slate-900.
    expect(contrastRatio(slate[900], brand(50))).toBeGreaterThan(4.5);
    expect(contrastRatio('#334155', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio('#e2e8f0', slate[900])).toBeGreaterThan(4.5);
    // The question's text on amber-50; the quiet lines on white and on slate-900.
    expect(contrastRatio(slate[900], '#fffbeb')).toBeGreaterThan(4.5);
    expect(contrastRatio(slate[600], '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio(slate[400], slate[900])).toBeGreaterThan(4.5);
    // Page Health's Change link: brand-700 on white, brand-300 on slate-900.
    expect(contrastRatio(brand(700), '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio(brand(300), slate[900])).toBeGreaterThan(4.5);
  });
});
