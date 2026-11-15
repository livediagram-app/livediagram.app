// @vitest-environment jsdom

// The Import dialog's A Whole Plan section (docs/specs/026-plan/plan-tabs.md "The Import dialog"): a liveplanner Plan
// row for an Editor beside the tools, dimmed for a guest; a plan's file picked or dropped is read and previewed in the
// browser (its name and what it holds), and Import as New Plan makes it. A file that is not a plan, one from a newer
// liveplanner and one past the cap are refused where they came in, the step left as it was.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type Item } from '@liveplanner/items';
import { PROJECT_FILE_MAX_BYTES, projectToEnvelopeText } from '@liveplanner/project';
import type { PlanFileImportActions } from '@/hooks/plan/usePlanFileImport';
import { ImportTabDialog } from './ImportTabDialog';
import { DROP_UNKNOWN } from './import/import-drop';
import {
  PLAN_GUEST_BLOCKED,
  PLAN_NEWER,
  PLAN_NOT_A_PLAN,
  PLAN_PICTURES,
  PLAN_RULES_OFF,
  PLAN_TOO_BIG,
  PROJECT_FILE_ACCEPT,
} from './import/plan-file-copy';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const { pick } = vi.hoisted(() => ({ pick: vi.fn() }));
vi.mock('@/lib/import-tab', async (original) => ({
  ...(await original<typeof import('@/lib/import-tab')>()),
  pickTabFile: pick,
}));

const NO_TRACKER = { canImport: false, contextFor: vi.fn(), importPlan: vi.fn() };
const EDITOR = { canImport: true, contextFor: vi.fn(async () => null), importPlan: vi.fn() };
const PERSON = { id: 'p', name: 'Ada', color: '#123456' };
const card = (id: string, key: number, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: PERSON,
  updatedBy: PERSON,
});

// A plan of two tabs, two cards (one with a picture), the default types and a rule.
const PLAN_FILE = projectToEnvelopeText(
  { id: 'A', name: 'Roadmap' },
  [
    { id: 't1', name: 'Board', elements: [] },
    { id: 't2', name: 'Money', elements: [] },
  ],
  1,
  [card('c1', 1, { title: 'One', attachments: [{ id: 'img1' }] as never }), card('c2', 2, {})],
  defaultCatalogue(),
  [],
  [],
  [{ id: 'r1', name: 'Rule' } as never],
);
const TYPES = defaultCatalogue().types.length;

function planFile(over: Partial<PlanFileImportActions> = {}): PlanFileImportActions {
  return {
    offered: true,
    blocked: null,
    importFile: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
}

function open(plan = planFile(), tracker: typeof EDITOR | typeof NO_TRACKER = EDITOR) {
  const onClose = vi.fn();
  render(
    <ImportTabDialog
      tabName="Overview"
      intoTab={{ kind: 'json' }}
      onImportFile={vi.fn()}
      onImportText={vi.fn()}
      tracker={tracker}
      planFile={plan}
      onClose={onClose}
    />,
  );
  return { onClose, plan };
}

const section = () => screen.getByRole('group', { name: 'A Whole Plan' });
const planRow = () => within(section()).getByRole('button');
const dropOn = (file: File) =>
  fireEvent.drop(screen.getByTestId('import-drop'), {
    dataTransfer: { types: ['Files'], files: [file] },
  });
const pickReturns = (text: string, extra: Record<string, unknown> = {}) =>
  pick.mockResolvedValueOnce({
    name: 'roadmap.liveplanner',
    text,
    file: new File([text], 'x'),
    ...extra,
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportTabDialog: A Whole Plan', () => {
  it('offers one liveplanner Plan row after the tools, for an Editor', () => {
    open();
    expect(section()).toBeTruthy();
    expect(planRow().getAttribute('aria-label')).toBe(
      'liveplanner Plan: A whole plan’s .liveplanner file from Export. Makes a new plan.',
    );
    expect(within(section()).getByText('.liveplanner')).toBeTruthy();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Into This Tab', 'A Board from Another Tool', 'A Whole Plan']);
  });

  it('has no section for someone who is not an Editor, who opens straight at the liveplanner Tab', () => {
    open(planFile({ offered: false }), NO_TRACKER);
    expect(screen.queryByRole('group', { name: 'A Whole Plan' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Import to Tab' })).toBeTruthy();
  });

  it('dims the row for a guest, saying why, and never opens the picker', () => {
    open(planFile({ blocked: PLAN_GUEST_BLOCKED }));
    expect(planRow()).toHaveProperty('disabled', true);
    expect(screen.getByText(PLAN_GUEST_BLOCKED)).toBeTruthy();
    fireEvent.click(planRow());
    expect(pick).not.toHaveBeenCalled();
  });

  it('previews a picked plan: its name, what it holds, the rules and pictures lines', async () => {
    pickReturns(PLAN_FILE);
    open();
    fireEvent.click(planRow());
    await screen.findByRole('heading', { name: 'Import a Plan' });
    expect(pick).toHaveBeenCalledWith(PROJECT_FILE_ACCEPT, { maxBytes: PROJECT_FILE_MAX_BYTES });
    expect(screen.getByText('Roadmap')).toBeTruthy();
    const holds = within(screen.getByRole('list', { name: 'What it holds' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(holds).toEqual(['2Tabs', '2Cards', `${TYPES}Card Types`, '1Rule']);
    expect(screen.getByText(PLAN_RULES_OFF)).toBeTruthy();
    expect(screen.getByText(PLAN_PICTURES)).toBeTruthy();
  });

  it('imports the previewed plan as a new plan, closing the dialog', async () => {
    pickReturns(PLAN_FILE);
    const { onClose, plan } = open();
    fireEvent.click(planRow());
    fireEvent.click(await screen.findByRole('button', { name: 'Import as New Plan' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(plan.importFile).toHaveBeenCalledWith(PLAN_FILE, 'Roadmap');
  });

  it('says why an import failed and keeps the preview, holding the buttons while it runs', async () => {
    let settle: (v: { ok: false; error: string }) => void = () => {};
    const importFile = vi.fn(() => new Promise<{ ok: false; error: string }>((r) => (settle = r)));
    pickReturns(PLAN_FILE);
    const { onClose } = open(planFile({ importFile }));
    fireEvent.click(planRow());
    fireEvent.click(await screen.findByRole('button', { name: 'Import as New Plan' }));
    const running = await screen.findByRole('button', { name: 'Importing…' });
    expect(running.getAttribute('aria-busy') ?? running.hasAttribute('disabled')).toBeTruthy();
    settle({ ok: false, error: 'Couldn’t import that plan. Try again.' });
    expect(await screen.findByText('Couldn’t import that plan. Try again.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Import a Plan' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes back to the list from the preview, and picks another file from it', async () => {
    pickReturns(PLAN_FILE);
    open();
    fireEvent.click(planRow());
    await screen.findByRole('heading', { name: 'Import a Plan' });
    pickReturns('not json');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Another File' }));
    expect(await screen.findByText(PLAN_NOT_A_PLAN)).toBeTruthy();
    // The preview stays as it was.
    expect(screen.getByText('Roadmap')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All Imports/ }));
    expect(screen.getByRole('heading', { name: 'Import' })).toBeTruthy();
    expect(section()).toBeTruthy();
  });

  it('refuses a picked file that is not a plan, a newer one and one past the cap, on the list', async () => {
    open();
    for (const [picked, said] of [
      [{ text: '{"kind":"liveplanner.tab","schemaVersion":1}' }, PLAN_NOT_A_PLAN],
      [{ text: '{"kind":"liveplanner.project","schemaVersion":9}' }, PLAN_NEWER],
      [{ text: '', tooBig: true }, PLAN_TOO_BIG],
    ] as const) {
      pickReturns(picked.text, picked);
      fireEvent.click(planRow());
      expect(await screen.findByText(said)).toBeTruthy();
      expect(screen.getByTestId('import-choose')).toBeTruthy();
    }
  });

  it('does nothing when the picker is cancelled', async () => {
    pick.mockResolvedValueOnce(null);
    open();
    fireEvent.click(planRow());
    await waitFor(() => expect(pick).toHaveBeenCalled());
    expect(screen.getByTestId('import-choose')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ImportTabDialog: a dropped plan file', () => {
  it('goes to its preview', async () => {
    open();
    dropOn(new File([PLAN_FILE], 'roadmap.liveplanner'));
    expect(await screen.findByRole('heading', { name: 'Import a Plan' })).toBeTruthy();
  });

  it('names an unnamed plan Untitled, with no rules or pictures lines when it holds neither', async () => {
    open();
    const bare = projectToEnvelopeText(
      { id: 'A', name: ' ' },
      [{ id: 't', name: 'T', elements: [] }],
      1,
    );
    dropOn(new File([bare], 'bare.liveplanner'));
    expect(await screen.findByText('Untitled')).toBeTruthy();
    expect(screen.queryByText(PLAN_RULES_OFF)).toBeNull();
    expect(screen.queryByText(PLAN_PICTURES)).toBeNull();
  });

  it('is refused past the cap, unread by the import', async () => {
    open();
    const big = new File([PLAN_FILE], 'roadmap.liveplanner');
    Object.defineProperty(big, 'size', { value: PROJECT_FILE_MAX_BYTES + 1 });
    dropOn(big);
    expect(await screen.findByText(PLAN_TOO_BIG)).toBeTruthy();
  });

  it('says the guest’s reason, and is no file this dialog takes without the section', async () => {
    open(planFile({ blocked: PLAN_GUEST_BLOCKED }));
    dropOn(new File([PLAN_FILE], 'roadmap.liveplanner'));
    await waitFor(() => expect(screen.getAllByText(PLAN_GUEST_BLOCKED)).toHaveLength(2));
    cleanup();
    open(planFile({ offered: false }));
    dropOn(new File([PLAN_FILE], 'roadmap.liveplanner'));
    expect(await screen.findByText(DROP_UNKNOWN)).toBeTruthy();
  });

  it('a dropped file that is not a plan leaves the preview as it was', async () => {
    open();
    dropOn(new File([PLAN_FILE], 'roadmap.liveplanner'));
    await screen.findByRole('heading', { name: 'Import a Plan' });
    dropOn(new File(['{"kind":"liveplanner.project","schemaVersion":9}'], 'new.liveplanner'));
    expect(await screen.findByText(PLAN_NEWER)).toBeTruthy();
    expect(screen.getByText('Roadmap')).toBeTruthy();
  });
});
