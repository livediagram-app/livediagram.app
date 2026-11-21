// @vitest-environment jsdom

// Describe to Set Up in the editor (docs/specs/030-knowledgebase/describe-to-set-up.md): who is offered the
// control, the dialog's three steps and every state between them, and that what a model sent is drawn as text.
import {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KNOWLEDGEBASE_FLOW, type Tab } from '@liveknowledge/document';
import type { KnowledgeAiSettings, KnowledgeSetupPage } from '@liveknowledge/api-schema';
import { EditorChromeContext, type EditorChromeStore } from '@/app/document/[id]/EditorContext';

const api = vi.hoisted(() => ({ apiKnowledgeAi: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
const setupApi = vi.hoisted(() => ({ apiSuggestSetup: vi.fn() }));
vi.mock('@/lib/knowledge-setup/setup-api', () => setupApi);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/article/article-grow-store', () => ({ markArticleSettle: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/tab-saved', () => ({ whenTabSaved: async () => true }));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));

import { chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { closeAiSettings, useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import {
  closeSetup,
  openSetup,
  usePublishedSetupOffered,
  useSetupOpen,
} from '@/lib/knowledge-setup/setup-open';
import { track } from '@/lib/telemetry';
import { PageTreeSheet } from '@/components/page-tree/PageTreeSheet';
import { DescribeToSetUpButton } from './DescribeToSetUpButton';
import { SetupDialog } from './SetupDialog';
import { SetupWhenOpen, useDescribeToAddPages } from './SetupHost';
import { useSetupOffered } from './useSetupOffered';

// A structure picked releases the page's edit draft first (create-structure.ts), so the editor has page editing.
const setupChrome = (...args: Parameters<typeof chromeValue>) => {
  const [role, over] = args;
  return chromeValue(role, { pageEditing: { editing: false, release: () => {} }, ...over });
};

const startPage = (): Tab =>
  ({
    id: 'start',
    name: 'Start Here',
    elements: [],
    articles: {
      [KNOWLEDGEBASE_FLOW]: {
        blocks: [{ id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Start Here' }] }],
      },
    },
  }) as unknown as Tab;
const writtenPage = (): Tab =>
  ({
    ...startPage(),
    id: 'w',
    name: 'Notes',
    articles: {
      [KNOWLEDGEBASE_FLOW]: {
        blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Something written.' }] }],
      },
    },
  }) as unknown as Tab;

const emptyKb = (over: Record<string, unknown> = {}) => {
  const tabs = [startPage()];
  return {
    documentName: 'Untitled Knowledgebase',
    tabs,
    activeId: 'start',
    activeTab: tabs[0],
    loadedTabIds: new Set(['start']),
    ...over,
  };
};

const settings = (over: Partial<KnowledgeAiSettings> = {}): KnowledgeAiSettings => ({
  provider: 'anthropic',
  providers: [
    { id: 'anthropic', label: 'Anthropic (Claude)', keyPrefix: 'sk-ant-' },
    { id: 'openai', label: 'OpenAI', keyPrefix: 'sk-' },
  ],
  hasKey: true,
  builtIn: true,
  keyHint: '4f2a',
  model: 'claude-fable-5-2',
  models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  ...over,
});

const suggested = (
  id: string,
  title: string,
  parent: string | null = null,
  depth = 1,
): KnowledgeSetupPage => ({
  id,
  title,
  summary: `About ${title}.`,
  headings: ['Overview'],
  parent,
  depth,
});
const SUGGESTION = {
  name: 'Engineering Handbook',
  pages: [
    suggested('p1', 'Getting Started'),
    suggested('p2', 'Local Setup', 'p1', 2),
    suggested('p3', 'How We Ship'),
    suggested('p4', 'On-Call', 'p3', 2),
  ],
};
const DESCRIPTION = 'The engineering handbook for a 12 person logistics startup.';

beforeEach(() => {
  offline.value = false;
  api.apiKnowledgeAi.mockResolvedValue(settings());
  setupApi.apiSuggestSetup.mockResolvedValue({ ok: true, suggestion: SUGGESTION });
});
afterEach(() => {
  cleanup();
  act(() => {
    closeSetup();
    closeAiSettings();
  });
  aiSettingsStore.reset();
  vi.clearAllMocks();
});

// A chrome store whose page list really changes, as the editor's does.
function liveChrome(role: Role, over: Record<string, unknown>) {
  let store!: EditorChromeStore;
  const named: string[] = [];
  const selected: string[] = [];
  const value = setupChrome(role, {
    ...over,
    commitTabs: (map: (tabs: Tab[]) => Tab[]) => {
      const tabs = map(store.get().tabs);
      store.set({ ...store.get(), tabs });
    },
    nameDocument: (name: string) => {
      named.push(name);
      store.set({ ...store.get(), documentName: name });
    },
    setActiveId: (id: string) => selected.push(id),
  });
  return { value, named, selected, bind: (made: EditorChromeStore) => (store = made) };
}

describe('who is offered Describe to Set Up', () => {
  const offered = (role: Role, over: Record<string, unknown> = emptyKb()) => {
    const { store } = renderInEditor(<></>, setupChrome(role, over));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorChromeContext.Provider value={store}>{children}</EditorChromeContext.Provider>
    );
    return {
      mode: renderHook(() => useSetupOffered(), { wrapper }).result.current,
      menu: renderHook(() => useDescribeToAddPages(), { wrapper }).result.current,
    };
  };

  it('is a signed-in Editor: the sidebar button while the knowledgebase is empty', () => {
    expect(offered('edit').mode).toBe('set-up');
    expect(offered('edit').menu).toBeNull();
  });

  // A Participant is an Editor minus the settings, the style and automations (knowledgebases-and-pages.md "Share
  // roles"): it is offered Describe to Set Up as an Editor is.
  it('is a signed-in Participant as an Editor', () => {
    expect(offered('participate').mode).toBe('set-up');
  });

  it.each(['view'] as const)('is never a %s session', (role) => {
    expect(offered(role)).toEqual({ mode: null, menu: null });
    expect(offered(role, { ...emptyKb(), tabs: [writtenPage()] })).toEqual({
      mode: null,
      menu: null,
    });
  });

  it('is not a page-scoped link, a guest, an Offline knowledgebase, an embed or a workbench', () => {
    expect(offered('edit', emptyKb({ isStructureReadOnly: true })).mode).toBeNull();
    expect(offered('edit', emptyKb({ accountUserId: null })).mode).toBeNull();
    expect(offered('edit', emptyKb({ embedMode: true })).mode).toBeNull();
    expect(offered('edit', emptyKb({ workbench: {} })).mode).toBeNull();
    expect(offered('edit', emptyKb({ hydrated: false })).mode).toBeNull();
    offline.value = true;
    expect(offered('edit').mode).toBeNull();
  });

  it('becomes Describe to Add Pages in the menu once the knowledgebase has writing', () => {
    const tabs = [writtenPage()];
    const { mode, menu } = offered('edit', emptyKb({ tabs, loadedTabIds: new Set(['w']) }));
    expect(mode).toBe('add');
    expect(menu!.label).toBe('Describe to Add Pages');
    act(() => menu!.onSelect());
    expect(renderHook(() => useSetupOpen()).result.current).toBe('add');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'DescribeToAddPages');
  });
});

describe('the host', () => {
  it('draws nothing until opened, then fetches and draws the dialog, and tells the palette what is offered', async () => {
    const { container } = renderInEditor(<SetupWhenOpen />, setupChrome('edit', emptyKb()));
    expect(container.innerHTML).toBe('');
    expect(renderHook(() => usePublishedSetupOffered()).result.current).toBe('set-up');
    act(() => openSetup('set-up'));
    expect(await screen.findByRole('dialog', {}, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText('Describe to Set Up')).toBeTruthy();
  });

  it.each(['view'] as const)('closes at once for a %s session', (role) => {
    renderInEditor(<SetupWhenOpen />, setupChrome(role, emptyKb()));
    act(() => openSetup('set-up'));
    expect(renderHook(() => useSetupOpen()).result.current).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(renderHook(() => usePublishedSetupOffered()).result.current).toBeNull();
  });
});

describe('the sidebar button', () => {
  it('is a full-width button with no line under it, and opens the dialog', () => {
    renderInEditor(<DescribeToSetUpButton />, setupChrome('edit', emptyKb()));
    const button = screen.getByRole('button', { name: 'Describe to Set Up' });
    expect(button.className).toContain('w-full');
    expect(button.getAttribute('title')).toBeNull();
    // Its line is the hover card's, never drawn under the button.
    expect(document.querySelector('[data-describe-to-set-up] > p')).toBeNull();
    fireEvent.click(button);
    expect(renderHook(() => useSetupOpen()).result.current).toBe('set-up');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'DescribeToSetUp');
  });

  it('is in a phone’s Pages sheet too, which closes as the dialog opens, with no line under it', () => {
    const tabs = [startPage()];
    const tree = {
      name: 'Handbook',
      tabs,
      activeId: 'start',
      canEdit: true,
      closed: new Set<string>(),
      actions: new Proxy({}, { get: () => () => {} }),
      knowledge: { marks: new Map(), inContext: new Set<string>() },
    } as unknown as Parameters<typeof PageTreeSheet>[0];
    renderInEditor(
      <>
        <DescribeToSetUpButton />
        <PageTreeSheet {...tree} />
      </>,
      setupChrome('edit', emptyKb({ tabs })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pages' }));
    const sheet = screen.getByRole('dialog', { name: 'Pages' });
    const inSheet = within(sheet).getByRole('button', { name: 'Describe to Set Up' });
    // Above New Page, full width, a thumb's height on a touch screen.
    const foot = inSheet.closest('[data-describe-to-set-up]')!.parentElement!;
    expect([...foot.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Describe to Set Up',
      expect.stringContaining('New Page'),
    ]);
    expect(inSheet.className).toContain('pointer-coarse:min-h-11');
    expect(screen.getAllByRole('button', { name: 'Describe to Set Up' })).toHaveLength(2);
    fireEvent.click(inSheet);
    expect(screen.queryByRole('dialog', { name: 'Pages' })).toBeNull();
    expect(renderHook(() => useSetupOpen()).result.current).toBe('set-up');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'DescribeToSetUp');
  });

  it('leaves the sidebar once a page has writing', () => {
    const tabs = [startPage()];
    const { store } = renderInEditor(
      <DescribeToSetUpButton />,
      setupChrome('edit', emptyKb({ tabs })),
    );
    expect(screen.getByRole('button', { name: 'Describe to Set Up' })).toBeTruthy();
    act(() =>
      store.set({
        ...store.get(),
        tabs: [{ ...writtenPage(), id: 'start' }],
      }),
    );
    expect(screen.queryByRole('button', { name: 'Describe to Set Up' })).toBeNull();
  });

  it.each(['view'] as const)('is not drawn for a %s session', (role) => {
    const { container } = renderInEditor(<DescribeToSetUpButton />, setupChrome(role, emptyKb()));
    expect(container.innerHTML).toBe('');
  });
});

async function openDialog(
  over: Record<string, unknown> = emptyKb(),
  mode: 'set-up' | 'add' = 'set-up',
) {
  const live = liveChrome('edit', over);
  const onClose = vi.fn();
  const utils = renderInEditor(<SetupDialog mode={mode} onClose={onClose} />, live.value);
  live.bind(utils.store);
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.querySelector('[data-setup-step]')).toBeTruthy());
  return { ...utils, ...live, dialog, onClose };
}
const field = () => document.querySelector<HTMLTextAreaElement>('[data-setup-description]')!;
const describe_ = (text: string) => fireEvent.change(field(), { target: { value: text } });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const step = () => document.querySelector('[data-setup-step]')!.getAttribute('data-setup-step');
async function toReview(over?: Record<string, unknown>, mode?: 'set-up' | 'add') {
  const opened = await openDialog(over, mode);
  if (mode === 'add') expect(screen.getByLabelText('What Pages Should Be Added?')).toBe(field());
  describe_(DESCRIPTION);
  press('Suggest a Structure');
  await waitFor(() => expect(step()).toBe('review'));
  return opened;
}
const rows = () => [...document.querySelectorAll<HTMLElement>('[data-setup-page]')];
const titleOfRow = (row: HTMLElement) => within(row).getByRole<HTMLInputElement>('textbox');
const tickOfRow = (row: HTMLElement) => within(row).getByRole<HTMLInputElement>('checkbox');

describe('step 1, Describe', () => {
  it('asks what the knowledgebase is for, with an example and three chips that fill the field', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByText('Describe to Set Up')).toBeTruthy();
    expect(screen.getByLabelText('What Is This Knowledgebase For?')).toBe(field());
    expect(document.activeElement).toBe(field());
    expect(screen.getByText(/12 person logistics startup/)).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector('[data-setup-ai]')?.textContent).toBe(
        "Uses this knowledgebase's key",
      ),
    );
    const steps = [...document.querySelectorAll('[data-setup-steps] li')];
    expect(steps.map((s) => s.textContent)).toEqual(['1Describe', '2Review', '3Create']);
    expect(steps[0]!.getAttribute('aria-current')).toBe('step');
    const chips = ['Engineering Handbook', 'Customer Support', 'Company Handbook'];
    for (const chip of chips) expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    press('Customer Support');
    expect(field().value).toContain('support playbook');
    expect(screen.getByRole('button', { name: 'Suggest a Structure' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('takes 20 to 1,000 characters, counting near the limit', async () => {
    await openDialog();
    const suggest = () =>
      screen.getByRole<HTMLButtonElement>('button', { name: 'Suggest a Structure' });
    expect(suggest().disabled).toBe(true);
    describe_('Too short');
    expect(suggest().disabled).toBe(true);
    expect(screen.getByText(/at least 20 characters/)).toBeTruthy();
    expect(document.querySelector('[data-setup-count]')).toBeNull();
    describe_('x'.repeat(950));
    expect(suggest().disabled).toBe(false);
    expect(document.querySelector('[data-setup-count]')!.textContent).toBe('950 / 1,000');
    describe_('x'.repeat(1001));
    expect(suggest().disabled).toBe(true);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    press('Suggest a Structure');
    expect(setupApi.apiSuggestSetup).not.toHaveBeenCalled();
  });

  it('sends the description alone when setting up, and holds the room with a skeleton meanwhile', async () => {
    let answer!: (value: unknown) => void;
    setupApi.apiSuggestSetup.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await openDialog();
    describe_(`  ${DESCRIPTION}  `);
    press('Suggest a Structure');
    expect(step()).toBe('suggesting');
    expect(screen.getByRole('status', { name: 'Suggesting a Structure' })).toBeTruthy();
    expect(setupApi.apiSuggestSetup.mock.calls[0]!.slice(1, 3)).toEqual([
      'd1',
      { description: DESCRIPTION },
    ]);
    await act(async () => answer({ ok: true, suggestion: SUGGESTION }));
    expect(step()).toBe('review');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'SetupSuggested');
    // The event's three fixed words only: no description, no title and no count reaches telemetry.
    const sent = JSON.stringify(vi.mocked(track).mock.calls);
    expect(sent).not.toContain('logistics');
    expect(sent).not.toContain('Getting Started');
  });

  it('cancels a request that is out, aborting it, and keeps the description', async () => {
    setupApi.apiSuggestSetup.mockReturnValue(new Promise(() => {}));
    await openDialog();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    const signal = setupApi.apiSuggestSetup.mock.calls[0]![3] as AbortSignal;
    expect(signal.aborted).toBe(false);
    press('Cancel');
    expect(signal.aborted).toBe(true);
    expect(step()).toBe('describe');
    expect(field().value).toBe(DESCRIPTION);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('aborts a request that is out when the dialog goes', async () => {
    setupApi.apiSuggestSetup.mockReturnValue(new Promise(() => {}));
    const { unmount } = await openDialog();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    unmount();
    expect((setupApi.apiSuggestSetup.mock.calls[0]![3] as AbortSignal).aborted).toBe(true);
  });

  it.each([
    ['bad-key', 'Claude Did Not Accept the Key', 'Open AI Settings'],
    ['no-credit', 'The Claude Account Is Out of Credit', null],
    ['overloaded', 'Claude Is Busy Right Now', null],
    ['person-limit', 'You Have Asked for 5 Structures This Hour', null],
    ['knowledgebase-limit', 'This Knowledgebase Has Had Its 20 Structures Today', null],
    ['no-structure', 'Could Not Suggest a Structure', null],
    ['network', 'The Description Could Not Be Sent', null],
    ['built-in-unavailable', 'Built-In AI Is Not Set Up Here', 'Open AI Settings'],
    ['built-in-limit', "You Have Used Today's 10 Built-In Suggestions", 'Open AI Settings'],
    ['built-in-failed', 'The Built-In AI Could Not Answer', null],
  ])(
    'says a failure in words, back at step 1 with the description kept: %s',
    async (kind, title, action) => {
      setupApi.apiSuggestSetup.mockResolvedValue({ ok: false, kind });
      await openDialog();
      describe_(DESCRIPTION);
      press('Suggest a Structure');
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(title);
      expect(alert.textContent).not.toMatch(/\b[45]\d\d\b/);
      expect(within(alert).queryByRole('button')?.textContent ?? null).toBe(action);
      expect(step()).toBe('describe');
      expect(field().value).toBe(DESCRIPTION);
      // Try again is the step's own button.
      expect(screen.getByRole('button', { name: 'Suggest a Structure' })).toHaveProperty(
        'disabled',
        false,
      );
    },
  );

  it('names OpenAI when the failure says so', async () => {
    setupApi.apiSuggestSetup.mockResolvedValue({ ok: false, kind: 'bad-key', provider: 'openai' });
    await openDialog();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'OpenAI Did Not Accept the Key',
    );
  });
});

describe('which AI answers', () => {
  const aiLine = () => document.querySelector('[data-setup-ai]')?.textContent ?? null;

  it('needs no key: step 1 at once, on built-in AI, said quietly, and its event says so', async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: false, keyHint: '' }));
    setupApi.apiSuggestSetup.mockResolvedValue({
      ok: true,
      suggestion: { ...SUGGESTION, provider: 'built-in' },
    });
    await openDialog();
    expect(step()).toBe('describe');
    await waitFor(() => expect(aiLine()).toBe('Uses built-in AI'));
    expect(screen.queryByText(/Needs Your Team's AI Key/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open AI Settings' })).toBeNull();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    await waitFor(() => expect(step()).toBe('review'));
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'SetupSuggestedBuiltIn');
    expect(track).not.toHaveBeenCalledWith('UI', 'Used', 'SetupSuggested');
  });

  it("offers AI Settings when built-in AI's day is used up, since the team's key is the way on", async () => {
    setupApi.apiSuggestSetup.mockResolvedValue({ ok: false, kind: 'built-in-limit' });
    await openDialog();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    within(await screen.findByRole('alert'))
      .getByRole('button', { name: 'Open AI Settings' })
      .click();
    expect(renderHook(() => useAiSettingsOpen()).result.current).toBe(true);
  });

  it("says the team's key once one is set", async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: false, keyHint: '' }));
    await openDialog();
    await waitFor(() => expect(aiLine()).toBe('Uses built-in AI'));
    act(() => aiSettingsStore.set('d1', settings()));
    expect(aiLine()).toBe("Uses this knowledgebase's key");
  });

  it('waits for nothing: step 1 while the settings are read, and when they cannot be, with no line', async () => {
    api.apiKnowledgeAi.mockReturnValue(new Promise(() => {}));
    await openDialog();
    expect(step()).toBe('describe');
    expect(aiLine()).toBeNull();
    cleanup();
    act(() => closeSetup());
    aiSettingsStore.reset();
    api.apiKnowledgeAi.mockRejectedValue(new Error('offline'));
    await openDialog();
    expect(step()).toBe('describe');
    expect(aiLine()).toBeNull();
    describe_(DESCRIPTION);
    press('Suggest a Structure');
    await waitFor(() => expect(step()).toBe('review'));
  });
});

describe('step 2, Review', () => {
  it('draws the tree as the sidebar does, each row a ticked checkbox, a title to rename and its line', async () => {
    await toReview();
    expect(rows().map((r) => [titleOfRow(r).value, r.dataset.depth])).toEqual([
      ['Getting Started', '1'],
      ['Local Setup', '2'],
      ['How We Ship', '1'],
      ['On-Call', '2'],
    ]);
    expect(rows().every((r) => tickOfRow(r).checked)).toBe(true);
    expect(Number.parseInt(rows()[1]!.style.paddingLeft)).toBeGreaterThan(
      Number.parseInt(rows()[0]!.style.paddingLeft),
    );
    expect(within(rows()[0]!).getByText('About Getting Started.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create 4 Pages' })).toBeTruthy();
    expect(screen.getByText(/Nothing has been written yet/)).toBeTruthy();
    expect(screen.getByText(/Undo takes back the last twenty/)).toBeTruthy();
  });

  it('unticks a page with its subpages, and the count follows the ticks', async () => {
    await toReview();
    fireEvent.click(tickOfRow(rows()[2]!));
    expect(rows().map((r) => tickOfRow(r).checked)).toEqual([true, true, false, false]);
    expect(titleOfRow(rows()[3]!).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Create 2 Pages' })).toBeTruthy();
    fireEvent.click(tickOfRow(rows()[3]!));
    expect(rows().map((r) => tickOfRow(r).checked)).toEqual([true, true, true, true]);
    fireEvent.click(tickOfRow(rows()[0]!));
    fireEvent.click(tickOfRow(rows()[2]!));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create 0 Pages' }).disabled).toBe(
      true,
    );
  });

  it('offers the suggested name only while the knowledgebase is still untitled', async () => {
    await toReview();
    expect(screen.getByLabelText<HTMLInputElement>('Knowledgebase Name').value).toBe(
      'Engineering Handbook',
    );
    cleanup();
    await toReview(emptyKb({ documentName: 'Our Handbook' }));
    expect(screen.queryByLabelText('Knowledgebase Name')).toBeNull();
  });

  it('goes back to step 1 with the description kept on Try Again, having written nothing', async () => {
    const { store } = await toReview();
    press('Try Again');
    expect(step()).toBe('describe');
    expect(field().value).toBe(DESCRIPTION);
    expect(store.get().tabs.map((t) => t.name)).toEqual(['Start Here']);
  });

  it('draws markup from a model as text, in a field and a text node, never as elements', async () => {
    setupApi.apiSuggestSetup.mockResolvedValue({
      ok: true,
      suggestion: {
        name: '<b>Name</b>',
        pages: [
          {
            ...suggested('p1', '<img src=x onerror=alert(1)>'),
            summary: '<script>window.pwned = true</script>',
          },
        ],
      },
    });
    const { dialog } = await toReview();
    expect(titleOfRow(rows()[0]!).value).toBe('<img src=x onerror=alert(1)>');
    expect(within(rows()[0]!).getByText('<script>window.pwned = true</script>')).toBeTruthy();
    expect(dialog.querySelector('img, script, b')).toBeNull();
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
  });

  it('says so, and creates nothing, when the pages would pass the page limit', async () => {
    const many = Array.from({ length: 498 }, (_x, at) => ({ ...writtenPage(), id: `t${at}` }));
    const { store } = await toReview(
      emptyKb({ tabs: many, loadedTabIds: new Set(), activeId: 't0', activeTab: many[0] }),
      'add',
    );
    expect(screen.getByRole('alert').textContent).toContain('holds at most 500 pages');
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create 4 Pages' });
    expect(create.disabled).toBe(true);
    fireEvent.click(create);
    expect(store.get().tabs).toHaveLength(498);
    // Unticking makes room.
    fireEvent.click(tickOfRow(rows()[2]!));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create 2 Pages' }).disabled).toBe(
      false,
    );
  });

  it('sends the existing titles in tree order when adding pages', async () => {
    const home = { ...writtenPage(), id: 'home', name: 'Home' };
    const sub = { ...writtenPage(), id: 'sub', name: 'Sub', parent: 'home' };
    await toReview(
      emptyKb({ tabs: [home, sub], loadedTabIds: new Set(), activeId: 'sub', activeTab: sub }),
      'add',
    );
    expect(setupApi.apiSuggestSetup.mock.calls[0]![2]).toEqual({
      description: DESCRIPTION,
      existing: [
        { title: 'Home', depth: 1 },
        { title: 'Sub', depth: 2 },
      ],
    });
    expect(screen.queryByLabelText('Knowledgebase Name')).toBeNull();
  });
});

describe('step 3, Create', () => {
  it('makes the ticked pages with their renames, takes over Start Here, names the knowledgebase and closes on the first page', async () => {
    const { store, onClose, named, selected } = await toReview();
    fireEvent.click(tickOfRow(rows()[3]!));
    fireEvent.change(titleOfRow(rows()[2]!), { target: { value: 'Shipping' } });
    fireEvent.change(screen.getByLabelText('Knowledgebase Name'), {
      target: { value: 'Our Handbook' },
    });
    press('Create 3 Pages');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const tabs = store.get().tabs;
    expect(tabs.map((t) => [t.name, t.parent ? 'sub' : 'top'])).toEqual([
      ['Getting Started', 'top'],
      ['Local Setup', 'sub'],
      ['Shipping', 'top'],
    ]);
    // The untouched Start Here page became the first page: its id stays, so it is the page already open.
    expect(tabs[0]!.id).toBe('start');
    expect(tabs[1]!.parent).toBe('start');
    expect(named).toEqual(['Our Handbook']);
    expect(selected).toEqual([]);
    expect(track).toHaveBeenCalledWith('Tab', 'Created', 'FromSetup');
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain('Shipping');
  });

  it('adds under the open page from Describe to Add Pages, changes nothing there, and opens the first new page', async () => {
    const home = { ...writtenPage(), id: 'home', name: 'Home' };
    const { store, onClose, named, selected } = await toReview(
      emptyKb({
        documentName: 'Handbook',
        tabs: [home],
        loadedTabIds: new Set(['home']),
        activeId: 'home',
        activeTab: home,
      }),
      'add',
    );
    press('Create 4 Pages');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const tabs = store.get().tabs;
    expect(tabs[0]).toBe(home);
    expect(tabs.map((t) => t.name)).toEqual([
      'Home',
      'Getting Started',
      'Local Setup',
      'How We Ship',
      'On-Call',
    ]);
    expect(tabs[1]!.parent).toBe('home');
    expect(tabs[3]!.parent).toBe('home');
    expect(named).toEqual([]);
    expect(selected).toEqual([tabs[1]!.id]);
  });

  it('keeps a knowledgebase with writing as it is when setting up: nothing is replaced', async () => {
    const tabs = [startPage(), { ...startPage(), id: 'b', name: 'Second' }];
    const { store, onClose } = await toReview(
      emptyKb({ tabs, loadedTabIds: new Set(['start', 'b']) }),
    );
    press('Create 4 Pages');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(
      store
        .get()
        .tabs.map((t) => t.name)
        .slice(0, 3),
    ).toEqual(['Start Here', 'Second', 'Getting Started']);
    expect(store.get().tabs).toHaveLength(6);
  });
});
