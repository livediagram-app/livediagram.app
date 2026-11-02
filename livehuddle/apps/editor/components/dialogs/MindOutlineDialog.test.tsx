// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createShape, type MindOutlineSummary, type ShapeElement } from '@livehuddle/document';
import type { ComponentProps } from 'react';
import { MindOutlineDialog } from './MindOutlineDialog';

// The Edit Outline dialog (docs/specs/009-elements/mind-node.md "Edit Outline").

const node = (label: string) => ({ ...createShape('mind-node', 0, 0), label }) as ShapeElement;
const none: MindOutlineSummary = { added: 0, renamed: 0, restyled: 0, moved: 0, removed: [] };

type OnSave = ComponentProps<typeof MindOutlineDialog>['onSave'];

function open(summary: MindOutlineSummary = none, initialText = 'Root\n- A\n- B') {
  const onSave = vi.fn<OnSave>();
  const onClose = vi.fn();
  render(
    <MindOutlineDialog
      initialText={initialText}
      summarise={() => summary}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

const level = (n: number) => screen.getAllByRole('textbox', { name: `Level ${n}` });
// A key on a row, its caret at the row's end.
const press = (row: HTMLElement, init: Parameters<typeof fireEvent.keyDown>[1]) => {
  row.focus();
  const end = document.createRange();
  end.selectNodeContents(row);
  end.collapse(false);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(end);
  fireEvent.keyDown(row, init);
};
// The outline Save would read, written out by ⌘Enter.
const saved = (onSave: Mock<OnSave>) => {
  press(screen.getByRole('textbox', { name: 'Root' }), { key: 'Enter', metaKey: true });
  return onSave.mock.calls.at(-1)?.[0];
};

afterEach(cleanup);

describe('MindOutlineDialog', () => {
  it('opens on one row per node, saying what Save will do', () => {
    open({ ...none, added: 2, renamed: 1, restyled: 1 });
    expect(screen.getByRole('textbox', { name: 'Root' }).textContent).toBe('Root');
    expect(level(1).map((r) => r.textContent)).toEqual(['A', 'B']);
    expect(screen.getByText('2 added, 1 renamed, 1 restyled')).toBeTruthy();
  });

  it('nests a row under the one above with Tab, and back out with Shift+Tab', () => {
    const { onSave } = open();
    press(level(1)[1]!, { key: 'Tab' });
    expect(level(2)[0]!.textContent).toBe('B');
    expect(saved(onSave)).toBe('Root\n- A\n  - B');
    press(level(2)[0]!, { key: 'Tab', shiftKey: true });
    expect(saved(onSave)).toBe('Root\n- A\n- B');
  });

  it('starts a new row with Enter', () => {
    open();
    press(level(1)[1]!, { key: 'Enter' });
    expect(level(1).map((r) => r.textContent)).toEqual(['A', 'B', '']);
  });

  it('bolds the word at the caret with Cmd/Ctrl+B', () => {
    const { onSave } = open();
    press(level(1)[0]!, { key: 'b', metaKey: true });
    expect((level(1)[0]!.querySelector('span') as HTMLElement).style.fontWeight).toBe('700');
    expect(saved(onSave)).toBe('Root\n- **A**\n- B');
  });

  it("never reads the browser's placeholder <br> in an emptied row as an extra line", () => {
    const { onSave } = open();
    const a = level(1)[0]!;
    a.innerHTML = '<span>A</span><br>';
    fireEvent.input(a);
    expect(saved(onSave)).toBe('Root\n- A\n- B');
  });

  it('reads a pasted list as rows', () => {
    open();
    const b = level(1)[1]!;
    b.focus();
    fireEvent.paste(b, { clipboardData: { getData: () => '- X\n  - Y' } });
    expect(level(1).map((r) => r.textContent)).toEqual(['A', 'B', 'X']);
    expect(level(2)[0]!.textContent).toBe('Y');
  });

  it('links the help article beside the close button', () => {
    open();
    expect(screen.getByRole('link').getAttribute('href')).toContain(
      'palette/mind-maps/edit-outline',
    );
  });

  it('cannot save without a root', () => {
    open(none, '');
    expect(screen.getByText('Write the root first')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true);
  });

  it('asks before removing nodes, naming them, and Keep Editing goes back', () => {
    const { onSave } = open({ ...none, removed: [node('Old idea')] });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Remove 1 node?' }).textContent).toContain(
      '“Old idea” will go, with its connectors',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onSave).toHaveBeenCalled();
  });
});

// An iPad's keyboard: the visual viewport shrinks under the window and iOS pans it down the page.
describe('MindOutlineDialog above the on-screen keyboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stays in the visible band, capped to it, while a row is edited', () => {
    const vv = Object.assign(new EventTarget(), {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
    });
    vi.stubGlobal('visualViewport', vv);
    open();
    const panel = screen.getByRole('dialog', { name: 'Edit Outline' });
    act(() => {
      level(1)[0]!.focus();
      vv.height = 380;
      vv.offsetTop = 90;
      vv.dispatchEvent(new Event('resize'));
    });
    const layer = panel.parentElement!;
    expect(layer.style.top).toBe('90px');
    expect(layer.style.height).toBe('380px');
    // Its own 90vh cap gives way to the band, and the panel scrolls inside it.
    expect(panel.style.maxHeight).toBe('calc(100% - 2rem)');
    expect(panel.style.overflowY).toBe('auto');
  });
});
