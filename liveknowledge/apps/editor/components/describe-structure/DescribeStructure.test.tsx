// @vitest-environment jsdom

// Describe Structure on a page (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure on a page"):
// who is offered it and where, the button beside Edit and beside Cancel, the dialog, the AI it says answers, what it
// sends, a failure in words, and the structure put into the draft at the top.
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KNOWLEDGEBASE_FLOW, type ArticleBlock, type Tab } from '@liveknowledge/document';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';

const api = vi.hoisted(() => ({ apiKnowledgeAi: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
const structureApi = vi.hoisted(() => ({ apiDescribeStructure: vi.fn() }));
vi.mock('@/lib/describe-structure/structure-api', () => structureApi);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));

import { chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { PageEditBarView } from '@/components/page-edit/PageEditBar';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { askAiChoiceStore } from '@/lib/knowledge-ask/ask-ai-choice';
import {
  closeDescribeStructure,
  openDescribeStructure,
  useDescribeStructureOpen,
} from '@/lib/describe-structure/structure-open';
import { track } from '@/lib/telemetry';
import { DescribeStructureDialog, draftTitleOf } from './DescribeStructureDialog';
import { DescribeStructureWhenOpen } from './DescribeStructureHost';
import { describeStructureOf, useDescribeStructureOffered } from './useDescribeStructureOffered';

const para = (id: string, text: string, style?: string): ArticleBlock =>
  ({ id, type: 'paragraph', ...(style ? { style } : {}), runs: text ? [{ text }] : [] }) as ArticleBlock;

const pageOf = (blocks: ArticleBlock[], over: Partial<Tab> = {}): Tab =>
  ({
    id: 'p1',
    name: 'Deploys',
    elements: [],
    articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
    ...over,
  });
const EMPTY = () => pageOf([para('t', 'Deploys', 'title'), para('e', '')]);
const WRITTEN = () => pageOf([para('t', 'Deploys', 'title'), para('w', 'We deploy on Tuesdays.')]);

const settings = (over: Partial<KnowledgeAiSettings> = {}): KnowledgeAiSettings => ({
  provider: 'anthropic',
  providers: [],
  hasKey: false,
  builtIn: true,
  keyHint: '',
  model: 'claude-fable-5-2',
  models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  ...over,
});

type Editing = { editing?: boolean; mayEdit?: boolean };
function chrome(
  page: Tab,
  { editing = false, mayEdit = true }: Editing = {},
  role: Role = 'edit',
  over: Record<string, unknown> = {},
) {
  const start = vi.fn();
  const commitTabs = vi.fn();
  const value = chromeValue(role, {
    tabs: [page],
    pageTab: page,
    activeTab: page,
    activeId: page.id,
    commitTabs,
    pageEditing: { editing, mayEdit, start },
    ...over,
  });
  return { value, start, commitTabs };
}

beforeEach(() => {
  offline.value = false;
  api.apiKnowledgeAi.mockResolvedValue(settings());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  aiSettingsStore.reset();
  askAiChoiceStore.reset();
  act(() => closeDescribeStructure());
  try {
    localStorage.clear();
  } catch {
    // jsdom always has it.
  }
});

describe('who is offered Describe Structure, and where', () => {
  it('is beside Edit on an empty page, beside Cancel while its draft is empty, and gone once it has writing', () => {
    expect(describeStructureOf(chrome(EMPTY()).value)).toBe('read');
    expect(describeStructureOf(chrome(EMPTY(), { editing: true }).value)).toBe('edit');
    expect(describeStructureOf(chrome(WRITTEN()).value)).toBeNull();
    expect(describeStructureOf(chrome(WRITTEN(), { editing: true }).value)).toBeNull();
    // A page with a drawing on it has something on it.
    const drawn = pageOf([para('t', 'Deploys', 'title')], {
      elements: [{ id: 'e1' }] as unknown as Tab['elements'],
    });
    expect(describeStructureOf(chrome(drawn).value)).toBeNull();
  });

  it('is offered to a signed-in person who may edit, and never to a Viewer, a guest, an embed or a workbench', () => {
    expect(describeStructureOf(chrome(EMPTY(), {}, 'participate').value)).toBe('read');
    expect(describeStructureOf(chrome(EMPTY(), { mayEdit: false }, 'view').value)).toBeNull();
    expect(describeStructureOf(chrome(EMPTY(), {}, 'edit', { accountUserId: null }).value)).toBeNull();
    expect(describeStructureOf(chrome(EMPTY(), {}, 'edit', { embedMode: true }).value)).toBeNull();
    expect(
      describeStructureOf(chrome(EMPTY(), {}, 'edit', { workbench: { id: 'w' } }).value),
    ).toBeNull();
  });

  it('is never offered in a knowledgebase kept Offline', () => {
    function Probe() {
      return <p data-testid="offered">{String(useDescribeStructureOffered())}</p>;
    }
    const { unmount } = renderInEditor(<Probe />, chrome(EMPTY()).value);
    expect(screen.getByTestId('offered').textContent).toBe('read');
    unmount();
    offline.value = true;
    renderInEditor(<Probe />, chrome(EMPTY()).value);
    expect(screen.getByTestId('offered').textContent).toBe('null');
  });
});

describe('the button', () => {
  const view = (editing: boolean, onDescribe?: () => void) => (
    <PageEditBarView
      editing={editing}
      mayEdit
      status=""
      agentChanges={0}
      others={[]}
      onEdit={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onDescribe={onDescribe}
    />
  );
  const order = () =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.replace(/[⌘]|Ctrl S|E$/g, '').trim());

  it('stands to the left of Edit while reading', () => {
    const onDescribe = vi.fn();
    renderInEditor(view(false, onDescribe));
    expect(order()).toEqual(['Describe Structure', 'Edit']);
    fireEvent.click(screen.getByRole('button', { name: 'Describe Structure' }));
    expect(onDescribe).toHaveBeenCalled();
  });

  it('stands to the left of Cancel while editing, and is gone when not offered', () => {
    const { rerender } = renderInEditor(view(true, vi.fn()));
    expect(order()).toEqual(['Describe Structure', 'Cancel', 'Save']);
    rerender(view(true));
    expect(screen.queryByRole('button', { name: 'Describe Structure' })).toBeNull();
  });
});

describe('the dialog', () => {
  const BLOCKS = [
    { kind: 'heading', level: 2, text: 'When We Deploy' },
    { kind: 'text', text: 'The days deploys go out.' },
  ];

  it('opens from the host, says which AI answers, and puts the structure into the draft', async () => {
    const page = EMPTY();
    const { value, commitTabs } = chrome(page, { editing: true });
    structureApi.apiDescribeStructure.mockResolvedValue({
      ok: true,
      blocks: BLOCKS,
      provider: 'built-in',
    });
    function Open() {
      return <p data-testid="open">{String(useDescribeStructureOpen())}</p>;
    }
    renderInEditor(
      <>
        <DescribeStructureWhenOpen />
        <Open />
      </>,
      value,
    );
    act(() => openDescribeStructure('p1'));
    const field = await screen.findByLabelText('What Is This Page For?');
    expect(field.getAttribute('placeholder')).toBe('What goes on “Deploys”, in your own words.');
    await waitFor(() => expect(screen.getByText('Uses built-in AI')).toBeTruthy());
    fireEvent.change(field, { target: { value: '  How we ship.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    await waitFor(() => expect(screen.getByTestId('open').textContent).toBe('null'));
    expect(structureApi.apiDescribeStructure).toHaveBeenCalledWith(
      { ownerId: 'me', shareCode: null },
      'd1',
      'p1',
      { purpose: 'How we ship.', title: 'Deploys' },
      expect.any(AbortSignal),
    );
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'DescribeStructure');
    // The commit maps the page: Title, the structure, an empty line for the caret.
    const map = commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[];
    const [after] = map([page]);
    const blocks = after!.articles![KNOWLEDGEBASE_FLOW]!.blocks;
    expect(blocks.map((b) => (b.type === 'paragraph' ? [b.style, b.runs[0]?.text] : b.type))).toEqual([
      ['title', 'Deploys'],
      ['h2', 'When We Deploy'],
      [undefined, 'The days deploys go out.'],
      [undefined, undefined],
    ]);
  });

  it("sends built-in when the person chose it over the team's key, and says so", async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: true }));
    askAiChoiceStore.set({ ownerId: 'me', shareCode: null }, 'd1', 'built-in');
    structureApi.apiDescribeStructure.mockResolvedValue({ ok: true, blocks: BLOCKS, provider: 'built-in' });
    renderInEditor(
      <DescribeStructureDialog tabId="p1" onClose={vi.fn()} />,
      chrome(EMPTY(), { editing: true }).value,
    );
    await waitFor(() => expect(screen.getByText('Uses built-in AI')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    await waitFor(() => expect(structureApi.apiDescribeStructure).toHaveBeenCalled());
    expect(structureApi.apiDescribeStructure.mock.calls[0]![3]).toMatchObject({ ai: 'built-in' });
  });

  it("says the team's key when one is set and not chosen away from", async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: true }));
    renderInEditor(
      <DescribeStructureDialog tabId="p1" onClose={vi.fn()} />,
      chrome(EMPTY(), { editing: true }).value,
    );
    await waitFor(() => expect(screen.getByText("Uses your team's key")).toBeTruthy());
  });

  it('tells a failure in words and keeps the dialog open, the page untouched', async () => {
    const { value, commitTabs } = chrome(EMPTY(), { editing: true });
    const onClose = vi.fn();
    structureApi.apiDescribeStructure.mockResolvedValue({ ok: false, kind: 'built-in-limit' });
    renderInEditor(<DescribeStructureDialog tabId="p1" onClose={onClose} />, value);
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    expect(await screen.findByText("You Have Used Today's 10 Built-In Drafts")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(commitTabs).not.toHaveBeenCalled();
    structureApi.apiDescribeStructure.mockResolvedValue({ ok: false, kind: 'no-structure' });
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    expect(await screen.findByText('The AI Could Not Draft This Page')).toBeTruthy();
  });

  it('enters edit mode first when it ended while the request was out', async () => {
    const { value, start, commitTabs } = chrome(EMPTY(), { editing: false });
    structureApi.apiDescribeStructure.mockResolvedValue({ ok: true, blocks: BLOCKS, provider: 'anthropic' });
    renderInEditor(<DescribeStructureDialog tabId="p1" onClose={vi.fn()} />, value);
    fireEvent.click(screen.getByRole('button', { name: 'Describe' }));
    await waitFor(() => expect(commitTabs).toHaveBeenCalled());
    expect(start).toHaveBeenCalled();
  });

  it('needs words when the page has no title, and refuses words over the bound', async () => {
    const untitled = pageOf([para('t', '', 'title')], { name: '' });
    renderInEditor(
      <DescribeStructureDialog tabId="p1" onClose={vi.fn()} />,
      chrome(untitled, { editing: true }).value,
    );
    const describe = screen.getByRole<HTMLButtonElement>('button', { name: 'Describe' });
    expect(describe.disabled).toBe(true);
    const field = screen.getByLabelText('What Is This Page For?');
    fireEvent.change(field, { target: { value: 'Our deploys.' } });
    expect(describe.disabled).toBe(false);
    fireEvent.change(field, { target: { value: 'x'.repeat(501) } });
    expect(describe.disabled).toBe(true);
    expect(screen.getByText('That is over the 500 characters this takes.')).toBeTruthy();
  });

  it('reads the title from the draft before the saved name', () => {
    const draft = {
      ...pageOf([para('t', 'Deploys', 'title')]),
      name: 'Untitled',
      articles: {
        [KNOWLEDGEBASE_FLOW]: { blocks: [para('t', '', 'title')] },
        draft: { blocks: [para('t', 'Time Off', 'title')] },
      },
      draft: { by: 'Ada', at: 1 },
    } as unknown as Tab;
    const { store } = renderInEditor(<span />, chrome(draft, { editing: true }).value);
    expect(draftTitleOf(store, 'p1')).toBe('Time Off');
    expect(draftTitleOf(store, 'elsewhere')).toBe('');
  });

  it('closes when its page is no longer the one open', async () => {
    const { value } = chrome(EMPTY(), { editing: true });
    const { store } = renderInEditor(<DescribeStructureWhenOpen />, value);
    act(() => openDescribeStructure('another'));
    await waitFor(() => expect(screen.queryByLabelText('What Is This Page For?')).toBeNull());
    expect(store).toBeTruthy();
  });
});
