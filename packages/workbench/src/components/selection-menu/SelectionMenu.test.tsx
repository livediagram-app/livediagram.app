// @vitest-environment jsdom
// The selection menu as drawn (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu"): Cut, Copy and
// Paste with their shortcuts, then Send to Plan and Send to Diagram; only the rows the words can take; a row's press
// closes it and does its verb; Escape closes it wherever focus is.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionMenuHost } from './SelectionMenu';
import {
  closeSelectionMenu,
  currentSelectionMenu,
  openSelectionMenu,
  type SelectionMenuActions,
} from './selection-menu-store';

const verbs = (over: Partial<SelectionMenuActions> = {}): SelectionMenuActions => ({
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  sendToPlan: vi.fn(),
  sendToDiagram: vi.fn(),
  ...over,
});

function open(actions: SelectionMenuActions, docked = false) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  act(() => {
    openSelectionMenu({
      anchor,
      at: { x: 40, y: 60 },
      placement: 'below-start',
      docked,
      actions,
    });
  });
}

afterEach(() => {
  act(() => closeSelectionMenu());
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('the selection menu', () => {
  it('draws nothing until asked', () => {
    render(<SelectionMenuHost />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('holds Cut, Copy and Paste with their keys, then the sends; a row does its verb and closes it', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn() } });
    render(<SelectionMenuHost />);
    const actions = verbs();
    open(actions);
    const rows = (await screen.findAllByRole('menuitem')).map((r) => r.textContent);
    expect(rows).toEqual([
      expect.stringMatching(/^Cut(⌘X|Ctrl\+X)$/),
      expect.stringMatching(/^Copy(⌘C|Ctrl\+C)$/),
      expect.stringMatching(/^Paste(⌘V|Ctrl\+V)$/),
      'Send to Plan',
      'Send to Diagram',
    ]);
    expect(screen.getByRole('region', { name: 'Selection actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: /Send to Plan/ }));
    expect(actions.sendToPlan).toHaveBeenCalledTimes(1);
    expect(currentSelectionMenu()).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs each verb from its row', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn() } });
    render(<SelectionMenuHost />);
    for (const name of ['Cut', 'Copy', 'Paste', 'Send to Diagram'] as const) {
      const actions = verbs();
      open(actions);
      fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(`^${name}`) }));
      const key = { Cut: 'cut', Copy: 'copy', Paste: 'paste', 'Send to Diagram': 'sendToDiagram' }[
        name
      ] as keyof SelectionMenuActions;
      expect(actions[key]).toHaveBeenCalledTimes(1);
    }
  });

  it('shows a reader only Copy and the sends, and greys Paste where the clipboard can’t be read', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<SelectionMenuHost />);
    open(verbs({ cut: null, paste: null, sendToDiagram: null }));
    const rows = (await screen.findAllByRole('menuitem')).map((r) => r.textContent);
    expect(rows).toEqual([expect.stringMatching(/^Copy/), 'Send to Plan']);
    act(() => closeSelectionMenu());
    open(verbs());
    const paste = await screen.findByRole('menuitem', { name: /^Paste/ });
    expect(paste.getAttribute('aria-disabled')).toBe('true');
  });

  it('docked on a touch screen, shows no keys and moves no focus', async () => {
    render(<SelectionMenuHost />);
    const before = document.activeElement;
    open(verbs(), true);
    const copy = await screen.findByRole('menuitem', { name: 'Copy' });
    expect(copy.textContent).toBe('Copy');
    expect(document.activeElement).toBe(before);
  });

  // The menu key's promise: from the writing being edited (where the shared menu leaves focus), the first row takes it,
  // so Arrow keys and Enter work the menu rather than the words.
  it('takes focus to its first row, even from the writing being edited', async () => {
    const writing = document.createElement('div');
    writing.contentEditable = 'true';
    writing.tabIndex = 0;
    document.body.append(writing);
    writing.focus();
    render(<SelectionMenuHost />);
    open(verbs());
    const cut = await screen.findByRole('menuitem', { name: /^Cut/ });
    await waitFor(() => expect(document.activeElement).toBe(cut));
  });

  it('stops trying for focus after a few frames when no row will take it', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => {});
    render(<SelectionMenuHost />);
    open(verbs());
    await screen.findByRole('menu');
    await new Promise((done) => setTimeout(done, 400));
    const tries = focus.mock.calls.length;
    await new Promise((done) => setTimeout(done, 100));
    expect(focus.mock.calls.length).toBe(tries);
    expect(document.activeElement).toBe(document.body);
    focus.mockRestore();
  });

  it('closes on Escape wherever focus is, and on no other key', async () => {
    render(<SelectionMenuHost />);
    open(verbs());
    await screen.findByRole('menu');
    fireEvent.keyDown(document, { key: 'a' });
    expect(currentSelectionMenu()).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(currentSelectionMenu()).toBeNull();
  });
});
