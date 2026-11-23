// @vitest-environment jsdom

// Page labels in the editor (docs/specs/030-knowledgebase/page-surface.md "Page labels", search-and-ask.md "By
// label" and "Answer From"): the meta row's pills and Add Label for every share role, the picker (on, off, create, a
// label opened in place), the tree's label filter, search following it, and Answer From in the Ask view.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeLabel, Tab } from '@liveknowledge/document';

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const confirm = vi.hoisted(() =>
  vi.fn(async (_options: { title: string; message: string }) => true),
);
vi.mock('@liveworkspace/workbench/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));
const api = vi.hoisted(() => ({
  apiCreateLabel: vi.fn(),
  apiUpdateLabel: vi.fn(),
  apiDeleteLabel: vi.fn(),
}));
vi.mock('@/lib/api/knowledge-labels', () => api);

import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { PageMetaRowView } from '@/components/knowledge/PageMetaRow';
import { SearchPanel } from '@/components/panels/SearchPanel';
import { createAskConversation } from '@/lib/knowledge-ask/ask-conversation';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { askLabelScopeStore, labelFilterStore } from '@/lib/page-labels/label-selection-store';
import { AnsweredFromLabels, AskLabelScope } from './AskLabelScope';
import { LabelFilterHeading } from './LabelFilterHeading';
import { LabelPickerHost, matchingLabels } from './LabelPicker';
import { labelDotColours } from './LabelPill';
import { AddLabelButton, PageLabelsNote, useAddLabel } from './PageLabelsNote';
import { labelIdsOfTab } from './page-labels-state';
import { useLabelFilterPages, useLabelFilterReveal } from './useLabelFilter';

const ENG: KnowledgeLabel = { id: 'lbl_eng', name: 'Engineering', colour: 'blue' };
const ONB: KnowledgeLabel = { id: 'lbl_onb', name: 'Onboarding', colour: '#aa00cc' };
const HR: KnowledgeLabel = { id: 'lbl_hr', name: 'People', colour: 'green' };
const ROLES_WRITE: readonly Role[] = ['edit', 'participate'];

beforeAll(() => {
  // A desktop window: the picker is a popover there.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  knowledgeSettingsStore.setLabels('d1', [ENG, ONB, HR]);
  labelFilterStore.reset();
  askLabelScopeStore.reset();
  for (const fn of [toast.error, track, confirm, ...Object.values(api)]) fn.mockClear();
  api.apiCreateLabel.mockImplementation(async () => ({
    labels: knowledgeSettingsStore.labelsOf('d1'),
  }));
  api.apiUpdateLabel.mockImplementation(async () => ({
    labels: knowledgeSettingsStore.labelsOf('d1'),
  }));
  api.apiDeleteLabel.mockImplementation(async () => ({
    labels: knowledgeSettingsStore.labelsOf('d1'),
  }));
});
afterEach(() => cleanup());

/** The editor's store over three pages, its commits applied as the editor's are. */
function mount(
  ui: React.ReactElement,
  labels: string[] = [],
  role: Role = 'edit',
  over: Record<string, unknown> = {},
) {
  const tabs = [
    { id: 'p1', name: 'Release Process', elements: [], ...(labels.length ? { labels } : {}) },
    { id: 'p2', name: 'Hotfixes', elements: [], parent: 'p1', labels: ['lbl_eng'] },
    { id: 'p3', name: 'Holidays', elements: [], labels: ['lbl_hr', 'lbl_eng'] },
  ] as Tab[];
  const ref: { store?: EditorChromeStore } = {};
  const value = chromeValue(role, {
    tabs,
    activeTab: tabs[0],
    commitTabs: (map: (ts: Tab[]) => Tab[]) => {
      const s = ref.store!.get();
      const next = map(s.tabs);
      ref.store!.set({ ...s, tabs: next, activeTab: next[0]! });
    },
    ...over,
  });
  const out = renderInEditor(
    <>
      {ui}
      <LabelPickerHost />
    </>,
    value,
  );
  ref.store = out.store;
  return { ...out, ids: () => labelIdsOfTab(out.store.get().activeTab) };
}

function MetaLabels() {
  const addLabel = useAddLabel();
  return (
    <PageMetaRowView
      trust={pageTrust(undefined, 90, 0)}
      now={0}
      verifiedBy={undefined}
      changedSinceVerified={false}
      addLabel={addLabel}
      labels={<PageLabelsNote />}
    />
  );
}

describe('on the page', () => {
  it.each(ROLES_WRITE)('offers %s Add Label on a page with none', (role) => {
    mount(<MetaLabels />, [], role);
    expect(screen.getByRole('button', { name: 'Add Label' })).toBeTruthy();
  });

  it('offers a Viewer no Add Label and no Edit Labels, but the pills, which filter their tree', () => {
    mount(<MetaLabels />, ['lbl_onb', 'gone'], 'view');
    expect(screen.queryByRole('button', { name: 'Add Label' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Labels' })).toBeNull();
    const pills = document.querySelectorAll('[data-page-label]');
    // A label deleted from the knowledgebase reads as none.
    expect([...pills].map((p) => p.textContent)).toEqual(['Onboarding']);
    fireEvent.click(pills[0]!);
    expect(labelFilterStore.idsOf('d1')).toEqual(['lbl_onb']);
    expect(labelFilterStore.revealCount()).toBe(1);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'LabelFilter');
  });

  it.each(ROLES_WRITE)('gives %s Edit Labels after the pills, and no Add Label', (role) => {
    mount(<MetaLabels />, ['lbl_eng'], role);
    expect(screen.queryByRole('button', { name: 'Add Label' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Labels' })).toBeTruthy();
  });

  it('draws a standard colour in its version for each appearance, and a custom one as it is', () => {
    const blue = labelDotColours('blue');
    expect(blue.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(blue.dark).not.toBe(blue.light);
    expect(labelDotColours('#aa00cc')).toEqual({ light: '#aa00cc', dark: '#aa00cc' });
    expect(labelDotColours('nonsense').light).toBe(labelDotColours('grey').light);
  });
});

describe('the picker across the first label', () => {
  it('stays open when the first label turns Add Label into Edit Labels, and moves to it', async () => {
    mount(<MetaLabels />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    fireEvent.click(document.querySelector('[data-label="lbl_onb"]')!);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Labels' }).getAttribute('aria-expanded'),
      ).toBe('true'),
    );
    expect(document.querySelector('[data-label-picker]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Label' })).toBeNull();
  });

  it('closes when the last label comes off and nothing stands to hold it', async () => {
    mount(<PageLabelsNote />, ['lbl_onb']);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Labels' }));
    fireEvent.click(document.querySelector('[data-label="lbl_onb"]')!);
    await waitFor(() => expect(document.querySelector('[data-label-picker]')).toBeNull());
  });
});

describe('the label picker', () => {
  const open = (name = 'Add Label') => fireEvent.click(screen.getByRole('button', { name }));
  const field = () => screen.getByRole('searchbox', { name: 'Find or Create a Label' });

  it('lists the labels most used first, each with its count, and puts one on and off at once', () => {
    const { ids } = mount(<AddLabelButton />);
    open();
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-label]')];
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Engineering, 2 pages',
      'People, 1 page',
      'Onboarding, 0 pages',
    ]);
    fireEvent.click(rows[2]!);
    expect(ids()).toEqual(['lbl_onb']);
    expect(track).toHaveBeenLastCalledWith('Element', 'Added', 'Label');
    // The picker stays open for the next.
    const again = document.querySelector<HTMLButtonElement>('[data-label="lbl_onb"]')!;
    expect(again.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(again);
    expect(ids()).toEqual([]);
    expect(track).toHaveBeenLastCalledWith('Element', 'Deleted', 'Label');
  });

  it('narrows to what is typed, and offers Create where no label is called that', async () => {
    const { ids } = mount(<AddLabelButton />);
    open();
    fireEvent.change(field(), { target: { value: 'eng' } });
    expect(document.querySelectorAll('[data-label]')).toHaveLength(1);
    expect(document.querySelector('[data-label-create]')?.textContent).toContain('eng');
    fireEvent.change(field(), { target: { value: 'engineering' } });
    expect(document.querySelector('[data-label-create]')).toBeNull();
    fireEvent.change(field(), { target: { value: '  Sales  Team ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    const made = knowledgeSettingsStore.labelsOf('d1').at(-1)!;
    expect(made).toMatchObject({ name: 'Sales Team', colour: 'orange' });
    expect(ids()).toEqual([made.id]);
    await waitFor(() => expect(api.apiCreateLabel).toHaveBeenCalledTimes(1));
    expect(api.apiCreateLabel.mock.calls[0]![2]).toEqual({
      id: made.id,
      name: 'Sales Team',
      colour: 'orange',
    });
  });

  it('takes a made label off the page again when the server refuses it', async () => {
    api.apiCreateLabel.mockRejectedValueOnce(new Error('down'));
    const { ids } = mount(<AddLabelButton />);
    open();
    fireEvent.change(field(), { target: { value: 'Sales' } });
    fireEvent.click(document.querySelector('[data-label-create]')!);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(ids()).toEqual([]);
    expect(knowledgeSettingsStore.labelsOf('d1').map((l) => l.name)).not.toContain('Sales');
  });

  it('refuses an eleventh label on one page in words', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`,
      name: `L${i}`,
      colour: 'red',
    }));
    knowledgeSettingsStore.setLabels('d1', [...many, ENG]);
    const { ids } = mount(
      <PageLabelsNote />,
      many.map((l) => l.id),
    );
    open('Edit Labels');
    fireEvent.click(document.querySelector('[data-label="lbl_eng"]')!);
    expect(toast.error).toHaveBeenCalledWith('A page carries at most 10 labels.');
    expect(ids()).toHaveLength(10);
    fireEvent.change(field(), { target: { value: 'New' } });
    fireEvent.click(document.querySelector('[data-label-create]')!);
    expect(api.apiCreateLabel).not.toHaveBeenCalled();
  });

  it('moves with the arrow keys from the field through the rows and back', () => {
    mount(<AddLabelButton />);
    open();
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    const rows = document.querySelectorAll<HTMLElement>('[data-label-row]');
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1]!, { key: 'ArrowUp' });
    fireEvent.keyDown(rows[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(field());
  });

  it('opens a label in place: a taken name refused there, a rename, a colour and a delete', async () => {
    mount(<AddLabelButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Label Engineering' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'people' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A label is already called that.');
    expect(api.apiUpdateLabel).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: 'Platform' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() =>
      expect(api.apiUpdateLabel).toHaveBeenCalledWith(expect.anything(), 'd1', 'lbl_eng', {
        name: 'Platform',
      }),
    );
    // Back to the list, the rename shown.
    await waitFor(() => expect(document.querySelector('[data-label-picker]')).toBeTruthy());
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'Label');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Label Platform' }));
    fireEvent.click(screen.getByRole('button', { name: /Pink/ }));
    await waitFor(() =>
      expect(api.apiUpdateLabel).toHaveBeenLastCalledWith(expect.anything(), 'd1', 'lbl_eng', {
        colour: 'pink',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Label' }));
    await waitFor(() => expect(api.apiDeleteLabel).toHaveBeenCalled());
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      title: 'Delete the Label Platform?',
      message: 'It comes off the 2 pages that carry it. This cannot be undone.',
    });
    expect(knowledgeSettingsStore.labelsOf('d1').map((l) => l.id)).not.toContain('lbl_eng');
  });

  it('keeps the labels when a delete is not confirmed', async () => {
    confirm.mockResolvedValueOnce(false);
    mount(<AddLabelButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Label Onboarding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Label' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      message: 'No page carries it. This cannot be undone.',
    });
    expect(api.apiDeleteLabel).not.toHaveBeenCalled();
  });

  it('orders a search: names that start with it, then those that hold it', () => {
    const all = [
      { id: 'a', name: 'Team Ops', colour: 'red' },
      { id: 'b', name: 'Operations', colour: 'red' },
    ];
    expect(matchingLabels(all, 'op').map((l) => l.id)).toEqual(['b', 'a']);
    expect(matchingLabels(all, ' ')).toEqual(all);
  });
});

describe('the label filter in the page tree', () => {
  const heading = (only: ReadonlySet<string> | null = null) => (
    <LabelFilterHeading only={only} inset="px-4" top="pt-2" />
  );

  it('offers Filter by Label only where the knowledgebase has labels', () => {
    knowledgeSettingsStore.setLabels('d1', []);
    mount(heading());
    expect(screen.queryByRole('button', { name: 'Filter by Label' })).toBeNull();
    cleanup();
    knowledgeSettingsStore.setLabels('d1', [ENG]);
    mount(heading(), [], 'edit', { documentId: null });
    expect(screen.getByText('Pages')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Filter by Label' })).toBeNull();
  });

  it.each(['edit', 'participate', 'view'] as const)(
    'lets %s add labels to the filter from its menu, see them in the bar, and clear them',
    (role) => {
      mount(heading(), [], role);
      fireEvent.click(screen.getByRole('button', { name: 'Filter by Label' }));
      const menu = screen.getByRole('menu');
      fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /People/ }));
      fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /Engineering/ }));
      expect(labelFilterStore.idsOf('d1')).toEqual(['lbl_hr', 'lbl_eng']);
      expect(track).toHaveBeenCalledTimes(2);
      const bar = screen.getByRole('group', { name: 'Label Filter' });
      expect(bar.textContent).toContain('Labelled');
      fireEvent.click(within(bar).getByRole('button', { name: 'Remove the Filter People' }));
      expect(labelFilterStore.idsOf('d1')).toEqual(['lbl_eng']);
      expect(screen.getByRole('button', { name: 'Filter by Label, 1 on' })).toBeTruthy();
      fireEvent.click(within(bar).getByRole('button', { name: 'Clear' }));
      expect(labelFilterStore.idsOf('d1')).toEqual([]);
      expect(screen.queryByRole('group', { name: 'Label Filter' })).toBeNull();
    },
  );

  it('is as tall as a finger needs on a phone', () => {
    labelFilterStore.set('d1', ['lbl_onb']);
    mount(<LabelFilterHeading only={new Set()} touch inset="" top="" />);
    for (const name of [
      'Filter by Label, 1 on',
      'Remove the Filter Onboarding',
      'Clear',
      'Clear Filter',
    ])
      expect(screen.getByRole('button', { name }).className).toMatch(/\bh-(9|11)\b/);
  });

  it('says when no page carries the labels, with Clear Filter', () => {
    labelFilterStore.set('d1', ['lbl_onb']);
    mount(heading(new Set()));
    expect(screen.getByText('No pages have these labels.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filter' }));
    expect(labelFilterStore.idsOf('d1')).toEqual([]);
  });

  it('lets a deleted label leave the filter', () => {
    labelFilterStore.set('d1', ['lbl_onb']);
    mount(heading());
    expect(screen.getByRole('group', { name: 'Label Filter' })).toBeTruthy();
    act(() => {
      knowledgeSettingsStore.setLabels('d1', [ENG, HR]);
    });
    expect(screen.queryByRole('group', { name: 'Label Filter' })).toBeNull();
  });
});

describe('search following the filter', () => {
  it('says the filter after its heading, with a button that clears it', () => {
    const onClear = vi.fn();
    render(
      <SearchPanel
        documents={[]}
        folders={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
        lead={{
          label: 'This Knowledgebase',
          items: [],
          note: 'No Pages Match',
          filter: { text: 'Labelled Engineering', onClear },
        }}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'This Knowledgebase, Labelled Engineering' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Label Filter' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('Answer From in the Ask view', () => {
  it('shows nothing where the knowledgebase has no labels', () => {
    knowledgeSettingsStore.setLabels('d1', []);
    const { container } = mount(<AskLabelScope />);
    expect(container.querySelector('[data-ask-label-scope]')).toBeNull();
  });

  it.each(['edit', 'participate', 'view'] as const)(
    'lets %s answer only from some labels, then from every page again',
    (role) => {
      mount(<AskLabelScope />, [], role);
      fireEvent.click(screen.getByRole('button', { name: 'Answer From All Pages' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Onboarding/ }));
      expect(askLabelScopeStore.idsOf('d1')).toEqual(['lbl_onb']);
      expect(
        screen.getByRole('button', { name: 'Answer Only From Onboarding' }).textContent,
      ).toContain('Only');
      fireEvent.click(screen.getByRole('button', { name: 'Stop Answering Only From Onboarding' }));
      expect(askLabelScopeStore.idsOf('d1')).toEqual([]);
    },
  );

  it('says under an answer the labels it was answered from', () => {
    mount(<AnsweredFromLabels ids={['lbl_eng', 'lbl_onb']} />);
    expect(document.querySelector('[data-ask-from-labels]')?.textContent).toBe(
      'From pages labelled Engineering, Onboarding',
    );
    cleanup();
    mount(<AnsweredFromLabels ids={undefined} />);
    expect(document.querySelector('[data-ask-from-labels]')).toBeNull();
    // Only labels since deleted: nothing to say.
    mount(<AnsweredFromLabels ids={['gone']} />);
    expect(document.querySelector('[data-ask-from-labels]')).toBeNull();
  });

  it('sends each question with the labels chosen as it was asked, and asks again with them', async () => {
    let chosen: string[] = ['lbl_eng'];
    const sent: unknown[] = [];
    const conversation = createAskConversation({
      send: async (request) => {
        sent.push(request);
        return { type: 'failed', kind: 'network' } as never;
      },
      frame: { request: () => 0, cancel: () => {} },
      newId: (() => {
        let n = 0;
        return () => `t${++n}`;
      })(),
      labels: () => chosen,
    });
    conversation.ask('When do we deploy?');
    expect(conversation.getTurns()[0]!.labels).toEqual(['lbl_eng']);
    await waitFor(() => expect(conversation.getTurns()[0]!.status).toBe('failed'));
    chosen = [];
    conversation.askAgain(conversation.getTurns()[0]!.id);
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual([
      { question: 'When do we deploy?', labels: ['lbl_eng'] },
      { question: 'When do we deploy?', labels: ['lbl_eng'] },
    ]);
    await waitFor(() => expect(conversation.isStreaming()).toBe(false));
    // A follow-up widens it again: no labels chosen, none sent.
    conversation.reset();
    conversation.ask('And hotfixes?');
    expect(conversation.getTurns()[0]!.labels).toBeUndefined();
    expect(sent.at(-1)).toEqual({ question: 'And hotfixes?' });
  });
});

describe('the edges', () => {
  it('does nothing with no knowledgebase open', () => {
    mount(<AddLabelButton />, [], 'edit', { documentId: null });
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    expect(document.querySelectorAll('[data-label]')).toHaveLength(0);
    expect(screen.getByText('No labels yet. Type a name to make the first.')).toBeTruthy();
    const empty = screen.getByRole('searchbox', { name: 'Find or Create a Label' });
    fireEvent.keyDown(empty, { key: 'ArrowDown' });
    fireEvent.keyDown(empty, { key: 'Enter' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find or Create a Label' }), {
      target: { value: 'Sales' },
    });
    fireEvent.click(document.querySelector('[data-label-create]')!);
    expect(api.apiCreateLabel).not.toHaveBeenCalled();
  });

  it('opens the tree where a pill asks, and keeps what the filter finds from the pages', () => {
    const revealed = vi.fn();
    const kept: (ReadonlySet<string> | null)[] = [];
    function Probe() {
      useLabelFilterReveal(revealed);
      kept.push(useLabelFilterPages());
      return null;
    }
    mount(<Probe />);
    expect(kept.at(-1)).toBeNull();
    expect(revealed).not.toHaveBeenCalled();
    act(() => labelFilterStore.set('d1', ['lbl_eng'], true));
    expect(revealed).toHaveBeenCalledTimes(1);
    expect([...kept.at(-1)!]).toEqual(['p2', 'p3']);
  });

  it('walks the filter menu with the arrow keys, round its ends, from the first row it focuses', async () => {
    labelFilterStore.set('d1', ['lbl_hr']);
    mount(<LabelFilterHeading only={null} inset="" top="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Label, 1 on' }));
    const items = screen.getAllByRole('menuitemcheckbox');
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(items[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items.at(-1));
    fireEvent.keyDown(items.at(-1)!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    // Taking a label away is no filter set.
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: /People/ }),
    );
    expect(track).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: /People/ }),
    );
    fireEvent.click(
      within(screen.getByRole('menu').parentElement!).getByRole('button', { name: 'Clear' }),
    );
    expect(labelFilterStore.idsOf('d1')).toEqual([]);
  });

  it('clears Answer From from its menu', () => {
    askLabelScopeStore.set('d1', ['lbl_eng']);
    mount(<AskLabelScope />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer Only From Engineering' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(askLabelScopeStore.idsOf('d1')).toEqual([]);
  });

  it('goes back unchanged, stays on a refused rename, keeps a colour picked again, and says one page', async () => {
    mount(<AddLabelButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Label People' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(document.querySelector('[data-label-picker]')).toBeTruthy());
    expect(api.apiUpdateLabel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Label People' }));
    fireEvent.click(screen.getByRole('button', { name: /^Green/ }));
    expect(api.apiUpdateLabel).not.toHaveBeenCalled();
    api.apiUpdateLabel.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: /^Pink/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(track).not.toHaveBeenCalledWith('Element', 'Changed', 'Label');
    api.apiUpdateLabel.mockRejectedValueOnce(new Error('down'));
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Staff' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(document.querySelector('[data-label-edit-view]')).toBeTruthy();
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Label' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      message: 'It comes off the page that carry it. This cannot be undone.',
    });
  });

  it('says when nothing matches, and leaves other keys and rows outside the list alone', () => {
    mount(<AddLabelButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    const field = screen.getByRole('searchbox', { name: 'Find or Create a Label' });
    fireEvent.change(field, { target: { value: 'a,b' } });
    expect(screen.getByText('No label matches.')).toBeTruthy();
    fireEvent.change(field, { target: { value: '' } });
    const edit = screen.getByRole('button', { name: 'Edit Label Engineering' });
    edit.focus();
    fireEvent.keyDown(edit, { key: 'ArrowDown' });
    fireEvent.keyDown(edit, { key: 'x' });
    expect(document.activeElement).toBe(edit);
    // Down from the last row stays there.
    const last = [...document.querySelectorAll<HTMLElement>('[data-label-row]')].at(-1)!;
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
  });

  it.each([
    [
      'the filter menu',
      () => <LabelFilterHeading only={null} inset="" top="" />,
      'Filter by Label',
    ],
    ['Answer From', () => <AskLabelScope />, 'Answer From All Pages'],
  ])('closes %s on Escape', async (_what, ui, name) => {
    mount(ui());
    fireEvent.click(screen.getByRole('button', { name }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'x' });
    fireEvent.keyDown(document.activeElement ?? menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes the picker on Escape', async () => {
    mount(<AddLabelButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    expect(document.querySelector('[data-label-picker]')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-label-picker]')).toBeNull());
  });
});
