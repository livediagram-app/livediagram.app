// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabMenu, type TabMenuProps } from './TabMenu';
import { sideBySideOf, tabMenuWords, type TabMenuSplit } from './tab-menu-rows';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('../../hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.phone,
}));
const clamp = vi.hoisted(() => ({ next: { x: 0, y: 0 } }));
vi.mock('../../lib/clamp-to-viewport', () => ({ clampToViewport: () => clamp.next }));

// The one tab menu every editor binds (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"):
// its rows in order for each part of the table, the words, the pickers, and where it opens.

const noop = () => {};
function anchor() {
  const button = document.createElement('button');
  document.body.appendChild(button);
  return button;
}
function props(over: Partial<TabMenuProps> = {}): TabMenuProps {
  return {
    anchor: anchor(),
    onClose: noop,
    words: { item: 'tab', holder: 'canvas' },
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}
// The menu's buttons by name, in the order they read.
const labels = () =>
  Array.from(screen.getByRole('dialog').querySelectorAll('button'), (b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
  );
const row = (name: string) => screen.getByRole('button', { name });
// A greyed row: a disabled button, or one inside an aria-disabled row.
const disabled = (name: string) => {
  const el =
    screen.queryByRole('button', { name }) ?? screen.getByText(name).closest('[aria-disabled]');
  return (
    (el as HTMLButtonElement).disabled === true || el?.closest('[aria-disabled="true"]') != null
  );
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  viewport.phone = false;
  clamp.next = { x: 0, y: 0 };
  vi.unstubAllGlobals();
});

describe('the rows', () => {
  it('reads toolbar, organise, file in order on a lockable tab', () => {
    render(
      <TabMenu
        {...props({
          onToggleLock: noop,
          onMoveToFolder: noop,
          copyTo: { label: 'Add to Another Canvas', disabled: false, picker: () => null },
          fileRows: <button type="button">Make Plan Cards</button>,
        })}
      />,
    );
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Lock Tab',
      'Delete',
      'Organise in Tab Folder',
      'Add to Another Canvas',
      'Import',
      'Export',
      'Make Plan Cards',
      'Clear',
    ]);
  });

  it('leaves out what the app does not offer', () => {
    render(<TabMenu {...props()} />);
    expect(labels()).toEqual(['Rename', 'Duplicate', 'Delete', 'Import', 'Export', 'Clear']);
  });

  it('puts the app’s own group after the organise rows', () => {
    render(<TabMenu {...props({ ownGroup: <button type="button">Attendance</button> })} />);
    expect(labels()).toEqual([
      'Rename',
      'Duplicate',
      'Delete',
      'Attendance',
      'Import',
      'Export',
      'Clear',
    ]);
  });

  it('greys Delete, Import and Clear for what the tab refuses, and names Unlock on a locked tab', () => {
    render(<TabMenu {...props({ locked: true, onToggleLock: noop, canClearContent: false })} />);
    expect(disabled('Delete')).toBe(true);
    expect(disabled('Import')).toBe(true);
    expect(disabled('Clear')).toBe(true);
    expect(row('Unlock Tab')).toBeTruthy();
    expect(disabled('Export')).toBe(false);
  });

  it('lets the app light Import on a locked tab, and name it', () => {
    render(<TabMenu {...props({ locked: true, canImport: true, importLabel: 'Import…' })} />);
    expect(disabled('Import…')).toBe(false);
  });

  it('greys Delete on the last tab and Add to Another when there is nowhere to add', () => {
    render(
      <TabMenu
        {...props({
          canDelete: false,
          copyTo: { label: 'Add to Document', disabled: true, picker: () => null },
        })}
      />,
    );
    expect(disabled('Delete')).toBe(true);
    expect(disabled('Add to Document')).toBe(true);
  });

  it('runs each verb', () => {
    const calls: string[] = [];
    const log = (name: string) => () => calls.push(name);
    render(
      <TabMenu
        {...props({
          onRename: log('rename'),
          onDuplicate: log('duplicate'),
          onToggleLock: log('lock'),
          onImport: log('import'),
          onExport: log('export'),
          onClearContent: log('clear'),
        })}
      />,
    );
    for (const name of ['Rename', 'Duplicate', 'Lock Tab', 'Import', 'Export', 'Clear'])
      fireEvent.click(row(name));
    expect(calls).toEqual(['rename', 'duplicate', 'lock', 'import', 'export', 'clear']);
  });

  it('spreads the toolbar evenly when the app asks', () => {
    render(<TabMenu {...props({ toolbar: 'spread' })} />);
    const spread = row('Delete').closest('.justify-between');
    expect(spread).not.toBeNull();
    expect(spread?.contains(row('Rename'))).toBe(true);
  });

  it('keeps Lock and Delete together at the right edge by default', () => {
    render(<TabMenu {...props({ onToggleLock: noop })} />);
    const edge = row('Delete').closest('.ml-auto');
    expect(edge?.contains(row('Lock Tab'))).toBe(true);
    expect(edge?.contains(row('Rename'))).toBe(false);
  });

  it('draws only the app’s lone row when it says so', () => {
    render(<TabMenu {...props({ only: <button type="button">Attendance</button> })} />);
    expect(labels()).toEqual(['Attendance']);
  });
});

describe('a connected tab’s menu', () => {
  const connected = (broken: boolean, onConnectAgain = noop) => ({ broken, onConnectAgain });

  it('keeps Rename, its folder, the app’s rows and Remove', () => {
    render(
      <TabMenu
        {...props({
          connected: connected(false),
          onMoveToFolder: noop,
          connectedRows: <button type="button">Attendance</button>,
        })}
      />,
    );
    expect(labels()).toEqual(['Rename', 'Organise in Tab Folder', 'Attendance', 'Remove Tab']);
  });

  it('offers Connect Again when it opens nothing, and drops Rename where its name follows its file', () => {
    const onConnectAgain = vi.fn();
    const onClose = vi.fn();
    render(
      <TabMenu
        {...props({ connected: connected(true, onConnectAgain), renameConnected: false, onClose })}
      />,
    );
    expect(labels()).toEqual(['Connect Again', 'Remove Tab']);
    fireEvent.click(row('Connect Again'));
    expect(onConnectAgain).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('removes the tab and closes, greyed for the last tab', () => {
    const onDelete = vi.fn();
    render(<TabMenu {...props({ connected: connected(false), onDelete })} />);
    fireEvent.click(row('Remove Tab'));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(disabled('Remove Tab')).toBe(false);
    cleanup();
    render(<TabMenu {...props({ connected: connected(false), canDelete: false })} />);
    expect(disabled('Remove Tab')).toBe(true);
  });
});

describe('the words', () => {
  it('builds every string from the item and its holder', () => {
    const tab = tabMenuWords({ item: 'tab', holder: 'canvas' });
    expect(tab.duplicate).toBe('Create a copy of this tab in this canvas.');
    expect(tab.sideBySideOpen).toBe(
      'Show this tab on the right, beside the tab you were on. Or drag its pill to the right edge.',
    );
    expect(tab.remove).toBe('Remove Tab');
    const page = tabMenuWords({ item: 'page', holder: 'knowledgebase' });
    expect(page.duplicate).toBe('Create a copy of this page in this knowledgebase.');
    // A page has no pill to drag.
    expect(page.sideBySideOpen).toBe('Show this page on the right, beside the page you were on.');
    expect(page.menuLabel).toBe('Page menu');
    expect(page.deleteLocked).toBe('This page is locked. Unlock it before deleting.');
  });

  it('names the menu for a screen reader by where it opened', () => {
    render(<TabMenu {...props({ words: { item: 'page', holder: 'knowledgebase' } })} />);
    expect(screen.getByRole('dialog', { name: 'Page menu' })).toBeTruthy();
    cleanup();
    render(<TabMenu {...props({ anchor: undefined, point: { x: 4, y: 4 } })} />);
    expect(screen.getByRole('dialog', { name: 'Canvas menu' })).toBeTruthy();
  });
});

describe('Side by Side', () => {
  const split = (over: Partial<TabMenuSplit> = {}): TabMenuSplit => ({
    available: true,
    pair: null,
    activeId: 't1',
    canOpen: () => true,
    open: vi.fn(),
    close: vi.fn(),
    ...over,
  });

  it('is absent where a split cannot open', () => {
    expect(sideBySideOf(null)).toBeNull();
    expect(sideBySideOf(split({ available: false }))).toBeNull();
    expect(sideBySideOf(split({ canOpen: () => false }))).toBeNull();
  });

  it('opens this tab beside the last, from the menu, and closes', () => {
    const s = split();
    const onClose = vi.fn();
    render(<TabMenu {...props({ split: s, onClose })} />);
    fireEvent.click(row('Side by Side'));
    expect(s.open).toHaveBeenCalledWith('t1', 'Menu');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes a split that is showing', () => {
    const s = split({ pair: { left: 't0', right: 't1' } });
    render(<TabMenu {...props({ split: s })} />);
    fireEvent.click(row('Close Side by Side'));
    expect(s.close).toHaveBeenCalledOnce();
  });
});

describe('the copy-to picker', () => {
  it('takes the menu’s place, and closing it closes the menu and hands focus back to the ⋯', async () => {
    const onClose = vi.fn();
    const p = props({
      onClose,
      copyTo: {
        label: 'Add to Another Canvas',
        disabled: false,
        picker: (close) => (
          <button type="button" onClick={close}>
            Picker Close
          </button>
        ),
      },
    });
    render(<TabMenu {...p} />);
    fireEvent.click(row('Add to Another Canvas'));
    fireEvent.click(await screen.findByRole('button', { name: 'Picker Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(p.anchor);
  });

  it('closes without moving focus when the ⋯ has gone', async () => {
    const onClose = vi.fn();
    const p = props({
      onClose,
      copyTo: {
        label: 'Add to Another Canvas',
        disabled: false,
        picker: (close) => (
          <button type="button" onClick={close}>
            Picker Close
          </button>
        ),
      },
    });
    render(<TabMenu {...p} />);
    fireEvent.click(row('Add to Another Canvas'));
    p.anchor!.remove();
    fireEvent.click(await screen.findByRole('button', { name: 'Picker Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('where it opens', () => {
  const box = () => document.querySelector<HTMLElement>('[data-tour-id="tab-menu"]')!;

  it('hangs above-left of the ⋯', () => {
    render(<TabMenu {...props()} />);
    expect(box().style.transform).toBe('translate(-100%, calc(-100% - 4px))');
  });

  it('opens at the pointer, growing down or up', () => {
    render(<TabMenu {...props({ anchor: undefined, point: { x: 10, y: 20 } })} />);
    expect(box().style.transform).toBe('none');
    expect(box().style.left).toBe('10px');
    cleanup();
    render(<TabMenu {...props({ anchor: undefined, point: { x: 10, y: 20, openUp: true } })} />);
    expect(box().style.transform).toBe('translate(0px, calc(-100% - 4px))');
  });

  it('draws nothing with neither an anchor nor a point', () => {
    render(<TabMenu {...props({ anchor: undefined })} />);
    expect(document.querySelector('[data-tour-id="tab-menu"]')).toBeNull();
  });

  it('nudges itself back on screen, again when its box changes', () => {
    let observed: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observed = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    clamp.next = { x: -30, y: 0 };
    render(<TabMenu {...props({ anchor: undefined, point: { x: 100, y: 20 } })} />);
    expect(box().style.left).toBe('70px');
    clamp.next = { x: -40, y: 5 };
    act(() => observed!());
    expect(box().style.left).toBe('60px');
    expect(box().style.top).toBe('25px');
  });

  it('is a bottom sheet on a phone, and blocks the browser’s own menu', () => {
    viewport.phone = true;
    render(<TabMenu {...props()} />);
    const sheet = box();
    expect(sheet.className).not.toContain('lvd-menu-stagger');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    sheet.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('blocks the browser’s own menu on the anchored box too', () => {
    render(<TabMenu {...props()} />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    box().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
