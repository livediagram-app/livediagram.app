// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import {
  EditorChromeContext,
  type EditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { KnowledgebaseMenu } from './KnowledgebaseMenu';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The knowledgebase's menu".
// The rows other features decide are theirs to test; here each is offered as its feature would offer an Editor.
const offered = { describe: true, ai: true, publish: true };
const openDescribe = vi.fn();
const openAi = vi.fn<() => void>();
const openPublish = vi.fn<() => void>();
vi.mock('@/components/setup/SetupHost', () => ({
  useDescribeToAddPages: () =>
    offered.describe ? { label: 'Describe to Add Pages', onSelect: openDescribe } : null,
}));
vi.mock('@/components/ask/useAskSession', () => ({
  useAskSession: () => ({
    rights: { manageAi: offered.ai, askOff: offered.publish ? null : 'offline' },
  }),
}));
vi.mock('@/lib/knowledge-ask/ai-settings-open', () => ({ openAiSettings: () => openAi() }));
vi.mock('@/lib/publishing/publish-open', () => ({ openPublishing: () => openPublish() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(offered, { describe: true, ai: true, publish: true });
  document.body.innerHTML = '';
});

type Session = Partial<
  Pick<EditorContextValue, 'isStructureReadOnly' | 'embedMode' | 'documentId'>
> & { level?: AccessLevel };

function storeFor({ level = 'edit', ...over }: Session = {}) {
  const handlers = {
    setImportOpen: vi.fn(),
    setExportOpen: vi.fn(),
    setExportScope: vi.fn(),
    deleteDocument: vi.fn(async () => {}),
  };
  const can = resolveEditorCapabilities(level);
  const value = {
    can,
    isStructureReadOnly: !can.editPages,
    hydrated: true,
    embedMode: false,
    workbench: null,
    sessionCommunity: null,
    documentId: 'kb',
    ...handlers,
    ...over,
  } as unknown as EditorContextValue;
  const store: EditorChromeStore = { get: () => value, set: () => {}, subscribe: () => () => {} };
  return { store, handlers };
}

function open(session: Session = {}, props: Partial<Parameters<typeof KnowledgebaseMenu>[0]> = {}) {
  const { store, handlers } = storeFor(session);
  const onRename = vi.fn();
  render(
    <EditorChromeContext.Provider value={store}>
      <KnowledgebaseMenu name="Engineering" onRename={onRename} {...props} />
    </EditorChromeContext.Provider>,
  );
  return { handlers, onRename };
}
const button = () => screen.getByRole('button', { name: 'Engineering: Knowledgebase Menu' });
const rows = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((r) => r.textContent);

describe('the knowledgebase’s menu', () => {
  it('is the name’s own button: it says it has a menu, and whether it is open', () => {
    open();
    expect(button().getAttribute('aria-haspopup')).toBe('menu');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().textContent).toBe('Engineering');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(button());
    expect(button().getAttribute('aria-expanded')).toBe('true');
    // The menu stands under the knowledgebase's name.
    expect(within(screen.getByRole('menu')).getByText('Engineering')).toBeTruthy();
  });

  it('holds an Editor’s rows in order, Delete last under a separator', () => {
    open();
    fireEvent.click(button());
    expect(rows()).toEqual([
      'Rename',
      'Describe to Add Pages',
      'Import',
      'Export',
      'Publish to the Web',
      'AI Settings',
      'Delete',
    ]);
    const menu = screen.getByRole('menu');
    const separator = within(menu).getByRole('separator');
    const last = within(menu).getAllByRole('menuitem').at(-1)!;
    expect(separator.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs each row and closes', () => {
    const { handlers, onRename } = open();
    const choose = (name: string) => {
      fireEvent.click(button());
      fireEvent.click(screen.getByRole('menuitem', { name }));
      expect(screen.queryByRole('menu')).toBeNull();
    };
    choose('Rename');
    expect(onRename).toHaveBeenCalledTimes(1);
    choose('Describe to Add Pages');
    expect(openDescribe).toHaveBeenCalledTimes(1);
    choose('Import');
    expect(handlers.setImportOpen).toHaveBeenCalledWith(true);
    choose('Export');
    expect(handlers.setExportOpen).toHaveBeenCalledWith(true);
    choose('Publish to the Web');
    expect(openPublish).toHaveBeenCalledTimes(1);
    choose('AI Settings');
    expect(openAi).toHaveBeenCalledTimes(1);
    choose('Delete');
    expect(handlers.deleteDocument).toHaveBeenCalledWith('kb');
  });

  it('moves through the rows with the arrow keys and closes on Escape, the focus back on the button', () => {
    open();
    fireEvent.click(button());
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement ?? menu, { key: 'End' });
    expect(document.activeElement).toBe(items.at(-1));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('opens on Down Arrow from the button', () => {
    const { onRename } = open();
    button().focus();
    // A letter at the closed button is nothing: the menu opens first.
    fireEvent.keyDown(button(), { key: 'T' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.keyDown(button(), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(button().getAttribute('aria-expanded')).toBe('true');
  });

  // Work Tracker 1376: the name is the menu's button, so a person who presses it and types a new name is renaming. The
  // letters spelled no row and the space pressed the focused Rename, so "Team Handbook" was saved as "Handbook".
  describe('a name typed at the open menu', () => {
    const typeAt = (text: string) => {
      for (const key of text) fireEvent.keyDown(document.activeElement ?? document.body, { key });
    };

    it('starts Rename with the letters typed, the menu closed', () => {
      const onChosen = vi.fn();
      const { onRename } = open({}, { onChosen });
      fireEvent.click(button());
      screen.getByRole('menuitem', { name: 'Rename' }).focus();
      typeAt('T');
      expect(onRename).toHaveBeenCalledWith('T');
      expect(onChosen).toHaveBeenCalledWith('rename');
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('lets letters that spell a row jump to it, then renames with all of them', () => {
      const { onRename } = open();
      fireEvent.click(button());
      screen.getByRole('menuitem', { name: 'Rename' }).focus();
      typeAt('Ex');
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Export' }));
      expect(onRename).not.toHaveBeenCalled();
      typeAt('po');
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Export' }));
      // The space after "Expo" is the name's: no row is pressed.
      typeAt(' ');
      expect(onRename).toHaveBeenCalledWith('Expo ');
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('takes keys typed before the menu has taken focus, on the button', () => {
      const { onRename } = open();
      fireEvent.click(button());
      button().focus();
      typeAt('Re');
      expect(onRename).not.toHaveBeenCalled();
      typeAt('l');
      expect(onRename).toHaveBeenCalledWith('Rel');
    });

    it('leaves Space, Enter and shortcuts to the menu', () => {
      const { onRename, handlers } = open();
      fireEvent.click(button());
      screen.getByRole('menuitem', { name: 'Import' }).focus();
      fireEvent.keyDown(document.activeElement!, { key: 'a', metaKey: true });
      fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
      expect(handlers.setImportOpen).toHaveBeenCalledWith(true);
      expect(onRename).not.toHaveBeenCalled();
    });

    it('is the menu’s alone where Rename is not a row (a Participant)', () => {
      const { onRename } = open({ level: 'participate' });
      fireEvent.click(button());
      typeAt('Team');
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeTruthy();
    });
  });

  it('leaves out a row its feature does not offer', () => {
    Object.assign(offered, { describe: false, ai: false, publish: false });
    open();
    fireEvent.click(button());
    expect(rows()).toEqual(['Rename', 'Import', 'Export', 'Delete']);
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": a Participant is an Editor minus the
  // Review Period, the style and automations; renaming and deleting the knowledgebase stay an Editor's.
  it('participate: Describe to Add Pages, Import and Export, never Rename, Publish, AI Settings or Delete', () => {
    Object.assign(offered, { ai: false });
    const { handlers } = open({ level: 'participate' });
    fireEvent.click(button());
    expect(rows()).toEqual(['Describe to Add Pages', 'Import', 'Export']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    expect(handlers.setImportOpen).toHaveBeenCalledWith(true);
  });

  it.each(['view'] as AccessLevel[])('%s: Export alone', (level) => {
    Object.assign(offered, { describe: false, ai: false });
    const { handlers } = open({ level }, { onRename: undefined });
    fireEvent.click(button());
    expect(rows()).toEqual(['Export']);
    expect(screen.queryByRole('separator')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }));
    expect(handlers.setExportOpen).toHaveBeenCalledWith(true);
  });

  it('an Editor confined to one page has Export alone too', () => {
    Object.assign(offered, { describe: false, ai: false });
    open({ isStructureReadOnly: true });
    fireEvent.click(button());
    expect(rows()).toEqual(['Export']);
  });

  it('an embed has no menu: the name alone, as text', () => {
    Object.assign(offered, { describe: false, ai: false });
    open({ embedMode: true });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Engineering').tagName).toBe('P');
  });

  it('is 44 px tall on a phone, and tells the sheet which row was chosen', () => {
    const onChosen = vi.fn();
    open({}, { touch: true, onChosen });
    expect(button().className).toContain('min-h-11');
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }));
    expect(onChosen).toHaveBeenCalledWith('export');
  });
});
