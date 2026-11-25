// @vitest-environment jsdom
// The selection menu as drawn (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu"): Cut, Copy and
// Paste with their shortcuts, then Send to Plan and Send to Diagram; only the rows the words can take; a row's press
// closes it and does its verb; Escape closes it wherever focus is.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
