// @vitest-environment jsdom

// The Review Period in the editor (docs/specs/030-knowledgebase/verification.md "The Review Period"): Page Health's
// pencil, who is offered it, the popover that says it applies to every page, the five rows, what a shorter period
// asks before it applies, and the one optimistic change with its undo and its rollback.
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '@liveknowledge/document';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';

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
import { track } from '@/lib/telemetry';
import { ReviewPeriodButton } from './ReviewPeriodButton';
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
const change = () => screen.getByRole('button', { name: /^Change Review Period/ });
const rows = () => screen.getAllByRole('radio');
const row = (name: string) => screen.getByRole('radio', { name });
const chosen = () => rows().find((r) => r.getAttribute('aria-checked') === 'true')?.textContent;
const ask = () => document.querySelector('[data-review-period-ask]')!;
const preview = (reviewDue: number, reviewDueNow: number) =>
  api.apiPreviewReviewPeriod.mockResolvedValue({ reviewEvery: 30, reviewDue, reviewDueNow });

/** Page Health's Change, pressed: the popover open once its code is in. */
async function openPopover(value = kb().value) {
  const utils = renderInEditor(<ReviewPeriodButton label="Every 90 Days" />, value);
  fireEvent.click(change());
  await screen.findByRole('dialog', { name: 'Review Period' });
  return utils;
}

beforeEach(() => {
  offline.value = false;
  api.apiSetReviewPeriod.mockImplementation(async (_who, _id, every: unknown) => every);
  preview(12, 3);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('who is offered the pencil', () => {
  it.each([
    ['edit', true],
    ['participate', false],
    ['view', false],
  ] as const)('a %s session: %s', (role, offered) => {
    const { store } = renderInEditor(<span />, kb(role).value);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorChromeContext.Provider value={store}>{children}</EditorChromeContext.Provider>
    );
    expect(renderHook(() => useSettingsOffered(), { wrapper }).result.current).toBe(offered);
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

  it('is offered for a knowledgebase kept Offline: it is its one person’s to set', () => {
    offline.value = true;
    expect(settingsOfferedOf(kb().value)).toBe(true);
  });

  it('has no offer without an editor around it', () => {
    expect(renderHook(() => useSettingsOffered()).result.current).toBe(false);
  });

  it('has no command of the palette any more: the period is changed where it is shown', () => {
    const handlers = new Proxy({}, { get: () => () => {} }) as never;
    const commands = buildEditorCommands(
      { isReadOnly: false, canvasTool: 'select' } as never,
      handlers,
    );
    expect(commands.map((c) => c.id)).not.toContain('knowledgebase-settings');
    expect(commands.map((c) => c.name)).not.toContain('Knowledgebase Settings');
  });
});

describe('the button and its popover', () => {
  it('is the period itself as a dotted link, that says it opens a popover, counted when it opens', async () => {
    renderInEditor(<ReviewPeriodButton label="Every 90 Days" />, kb().value);
    expect(change().textContent).toBe('Every 90 Days');
    expect(change().querySelector('svg')).toBeNull();
    expect(change().className).toContain('decoration-dotted');
    expect(change().getAttribute('aria-haspopup')).toBe('dialog');
    expect(change().getAttribute('aria-expanded')).toBe('false');
    expect(change().className).toContain('cursor-pointer');
    expect(change().className).toContain('phone:min-h-11');
    fireEvent.click(change());
    await screen.findByRole('dialog', { name: 'Review Period' });
    expect(change().getAttribute('aria-expanded')).toBe('true');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ReviewPeriod');
    // Pressed again, it closes.
    fireEvent.click(change());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says it applies to every page, with the five rows and the line that says what they do', async () => {
    await openPopover();
    expect(screen.getByRole('heading', { name: 'Review Period' })).toBeTruthy();
    expect(document.querySelector('[data-review-period-scope]')!.textContent).toBe(
      'Applies to every page in this knowledgebase.',
    );
    const group = screen.getByRole('radiogroup', { name: 'Review Period' });
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
    await openPopover(value);
    fireEvent.click(row('Every Year'));
    // At once, before the server answers, with no question (waited for: a loaded runner can render a frame late).
    await waitFor(() => expect(chosen()).toBe('Every Year'));
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

  it('does nothing for the period already chosen', async () => {
    await openPopover();
    fireEvent.click(row('Every 90 Days'));
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
    expect(api.apiPreviewReviewPeriod).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('says how many pages a shorter period makes due before it applies, with Apply and Cancel', async () => {
    const { documentId, value } = kb();
    await openPopover(value);
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
    // Cancel leaves everything as it was, and the popover open.
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
    await openPopover();
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
    await openPopover();
    fireEvent.click(row('Every 30 Days'));
    fireEvent.click(row('Every Year'));
    await act(async () => answer({ reviewEvery: 30, reviewDue: 40, reviewDueNow: 1 }));
    expect(chosen()).toBe('Every Year');
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('ends a count still running when the popover closes', async () => {
    let signal: AbortSignal | undefined;
    api.apiPreviewReviewPeriod.mockImplementationOnce(
      (_who: unknown, _id: unknown, _every: unknown, s: AbortSignal) => {
        signal = s;
        return new Promise(() => {});
      },
    );
    await openPopover();
    fireEvent.click(row('Every 30 Days'));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(signal?.aborted).toBe(true);
    expect(api.apiSetReviewPeriod).not.toHaveBeenCalled();
  });

  it.each([
    [new ApiError('set review period', 403, 'forbidden'), 'Only an Editor can change'],
    [new Error('down'), 'so it is back as it was'],
  ])(
    'puts the period back and says why in words when the change is refused',
    async (err, words) => {
      // Held until the choice shows, so the revert can't land first on a loaded runner.
      let refuse!: (e: unknown) => void;
      api.apiSetReviewPeriod.mockReturnValue(
        new Promise((_, reject) => {
          refuse = reject;
        }),
      );
      const { documentId, value } = kb();
      await openPopover(value);
      fireEvent.click(row('Never'));
      await waitFor(() => expect(chosen()).toBe('Never'));
      refuse(err);
      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error.mock.calls[0]![0]).toContain(words);
      expect(toast.error.mock.calls[0]![0]).not.toMatch(/403|forbidden/);
      expect(chosen()).toBe('Every 90 Days');
      expect(knowledgeSettingsStore.reviewEveryOf(documentId)).toBe(90);
      expect(toast.info).not.toHaveBeenCalled();
    },
  );

  it('follows a change made by someone else while it is open', async () => {
    const { documentId, value } = kb();
    await openPopover(value);
    act(() => void knowledgeSettingsStore.take(documentId, { reviewEvery: 180 }));
    await waitFor(() => expect(chosen()).toBe('Every 180 Days'));
  });

  it('counts from the pages it holds and writes the record, for a knowledgebase kept Offline', async () => {
    offline.value = true;
    const { documentId, value } = kb();
    await openPopover(value);
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

  it('keeps room for the question always there, so the popover never changes height', async () => {
    await openPopover();
    expect(ask().className).toContain('min-h-[6.5rem]');
    expect(ask().getAttribute('aria-live')).toBe('polite');
    expect(ask().textContent).toContain('No page is rewritten.');
    for (const r of rows()) {
      expect(r.className).toContain('min-h-11');
      expect(r.className).toContain('cursor-pointer');
      expect(r.className).toContain('focus-visible:outline-2');
    }
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
    // The "every page" line: brand-800 on white, brand-200 on slate-900.
    expect(contrastRatio(brand(800), '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio(brand(200), slate[900])).toBeGreaterThan(4.5);
    // The pencil (a glyph, 3:1 is its bar): slate-600 on white, brand-700 on brand-50 hovered, slate-300 on slate-900.
    expect(contrastRatio(slate[600], '#ffffff')).toBeGreaterThan(3);
    expect(contrastRatio(brand(700), brand(50))).toBeGreaterThan(3);
    expect(contrastRatio('#cbd5e1', slate[900])).toBeGreaterThan(3);
  });
});
