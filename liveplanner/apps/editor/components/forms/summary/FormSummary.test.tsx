// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { FormDefinition } from '@liveplanner/forms';
import { cellKey, type Cell } from '@liveplanner/sheets';
import { FormSummary } from './FormSummary';

// The Summary (docs/specs/030-forms/forms.md "The Summary").

const world: {
  items: Map<string, unknown>;
  store: {
    sheet: (id: string) => unknown;
    status: (tab: string) => string | undefined;
    loadTab: ReturnType<typeof vi.fn>;
  } | null;
} = { items: new Map(), store: null };

vi.mock('@/components/plan/PlanContext', () => ({
  usePlan: () => ({
    items: world.items,
    types: [{ id: 'task', label: 'Task', fields: ['title'] }],
  }),
}));
vi.mock('@/components/plan/dashboard/useSheetReader', () => ({
  useSheetStore: () => ({ store: world.store, version: 1, locale: 'en-GB' }),
}));

afterEach(() => {
  cleanup();
  world.items = new Map();
  world.store = null;
});

const FORM: FormDefinition = {
  v: 1,
  heading: 'Feedback',
  sections: [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name', goesTo: { to: 'title' } },
        { id: 'q-reply', type: 'single', prompt: 'Reply by', options: ['Email', 'Phone'] },
        { id: 'q-stars', type: 'rating', prompt: 'Stars' },
        { id: 'q-age', type: 'number', prompt: 'Age' },
        { id: 'q-hue', type: 'colour', prompt: 'Hue' },
        { id: 'q-why', type: 'paragraph', prompt: 'Why' },
      ],
    },
  ],
  destination: { tabId: 'board', typeId: 'task', status: 'new' },
};

const card = (n: number, title: string, description: string) =>
  [
    `c${n}`,
    { id: `c${n}`, type: 'task', fields: { title, description, fromForm: `form:${n}` } },
  ] as const;

function show(form: FormDefinition = FORM, onShare?: () => void) {
  const onOpenResponses = vi.fn();
  render(
    <FormSummary
      form={form}
      tabId="form"
      destinationName="Feedback Responses"
      onOpenResponses={onOpenResponses}
      onShare={onShare}
    />,
  );
  return onOpenResponses;
}

describe('a board form', () => {
  it('says there is nothing yet, with Share Form for an Editor', () => {
    const share = vi.fn();
    show(FORM, share);
    expect(screen.getByRole('heading', { name: 'No Responses Yet' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Share Form' }));
    expect(share).toHaveBeenCalled();
    cleanup();
    show();
    expect(screen.queryByRole('button', { name: 'Share Form' })).toBeNull();
  });

  it('sums up each question from the cards', () => {
    world.items = new Map([
      card(1, 'Ada', 'Reply by\nEmail\n\nStars\n4 / 5\n\nAge\n30\n\nHue\n#ef4444'),
      card(2, 'Cy', 'Reply by\nEmail\n\nStars\n5 / 5\n\nAge\n41'),
      card(3, 'Bo', 'Reply by\nPhone'),
      ...[4, 5, 6, 7, 8, 9].map((n) => card(n, `P${n}`, `Why\nReason ${n}`)),
    ]);
    const open = show();
    expect(screen.getByRole('heading', { name: '9 Responses' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Feedback Responses' }));
    expect(open).toHaveBeenCalled();

    const reply = within(screen.getByRole('region', { name: 'Reply by' }));
    expect(reply.getByText('3 of 9 answered')).toBeTruthy();
    expect(reply.getByText('Email').closest('li')!.textContent).toContain('267%');
    expect(reply.getByText('Phone').closest('li')!.textContent).toContain('133%');

    const stars = within(screen.getByRole('region', { name: 'Stars' }));
    expect(stars.getByText('4.5')).toBeTruthy();
    expect(stars.getByText('Average of 5')).toBeTruthy();

    const age = within(screen.getByRole('region', { name: 'Age' }));
    expect(age.getByText('35.5')).toBeTruthy();
    expect(age.getByText('30')).toBeTruthy();
    expect(age.getByText('41')).toBeTruthy();

    const hue = within(screen.getByRole('region', { name: 'Hue' }));
    expect(hue.getByText('#ef4444').closest('li')!.textContent).toContain('1100%');

    const why = within(screen.getByRole('region', { name: 'Why' }));
    expect(why.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Reason 9',
      'Reason 8',
      'Reason 7',
      'Reason 6',
      'Reason 5',
    ]);
    expect(
      why.getByText(/The newest 5 of 6\. Every answer is on Feedback Responses\./),
    ).toBeTruthy();
  });

  it('says so for a question nobody answered, and a lone response is one Response', () => {
    world.items = new Map([card(1, 'Ada', '')]);
    show();
    expect(screen.getByRole('heading', { name: '1 Response' })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Stars' })).getByText(
        'Nobody has answered this one.',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Name' })).getByText('1 of 1 answered'),
    ).toBeTruthy();
  });
});

describe('a sheet form', () => {
  const SHEET_FORM: FormDefinition = {
    ...FORM,
    destination: undefined,
    sheet: { tabId: 'sheet', sheetId: 'sh', columns: { '#': 'c0', 'q-reply': 'c1' } },
  };
  const cells = new Map<string, Cell>([
    [cellKey('r1', 'c0'), { input: { n: 1 } }],
    [cellKey('r1', 'c1'), { input: { s: 'Phone' } }],
  ]);

  it('waits for its sheet, then sums up its rows', () => {
    world.store = { sheet: () => undefined, status: () => 'loading', loadTab: vi.fn() };
    show(SHEET_FORM);
    expect(world.store.loadTab).toHaveBeenCalledWith('sheet');
    expect(screen.getByLabelText('Reading the responses')).toBeTruthy();
    cleanup();
    world.store = {
      sheet: () => ({ layout: { rows: ['r1'] }, cells }),
      status: () => 'ready',
      loadTab: vi.fn(),
    };
    show(SHEET_FORM);
    expect(screen.getByRole('heading', { name: '1 Response' })).toBeTruthy();
    expect(screen.getByText(/Read from the rows on Feedback Responses/)).toBeTruthy();
    expect(screen.getByText('Phone').closest('li')!.textContent).toContain('1100%');
  });

  it('offers Try Again when its sheet cannot be read, and waits outside the editor', () => {
    const loadTab = vi.fn();
    world.store = { sheet: () => undefined, status: () => 'error', loadTab };
    show(SHEET_FORM);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(loadTab).toHaveBeenLastCalledWith('sheet', true);
    cleanup();
    world.store = null;
    show(SHEET_FORM);
    expect(screen.getByLabelText('Reading the responses')).toBeTruthy();
  });

  it('reads an empty sheet as no responses yet', () => {
    world.store = {
      sheet: () => ({ layout: { rows: [] }, cells: new Map() }),
      status: () => 'ready',
      loadTab: vi.fn(),
    };
    show(SHEET_FORM);
    expect(screen.getByText(/Each response becomes a row on Feedback Responses/)).toBeTruthy();
  });
});
