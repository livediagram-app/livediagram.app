// @vitest-environment jsdom

// The sidebar's ARIA tree keyboard model (docs/specs/013-workspace/explorer-structure.md#keyboard-and-aria).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTreeNavigation } from './useTreeNavigation';

afterEach(cleanup);

function Item({
  label,
  selected = false,
  expanded,
  onToggle,
  onActivate,
  children,
}: {
  label: string;
  selected?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onActivate?: () => void;
  children?: ReactNode;
}) {
  return (
    <li
      role="treeitem"
      aria-label={label}
      aria-selected={selected}
      aria-expanded={expanded}
      data-tree-label={label}
      tabIndex={-1}
    >
      <div data-tree-row>
        <span data-tree-toggle onClick={onToggle} />
        <span data-tree-activate onClick={onActivate}>
          {label}
        </span>
        <button type="button" tabIndex={-1}>
          menu
        </button>
      </div>
      {expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}

function Tree({ onActivate = () => {} }: { onActivate?: (label: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const nav = useTreeNavigation(ref);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button">before</button>
      <nav ref={ref} {...nav}>
        <ul role="tree" aria-label="Overview">
          <Item label="Home" onActivate={() => onActivate('Home')} />
          <Item label="Inbox" />
        </ul>
        <ul role="tree" aria-label="Spaces">
          <Item
            label="My documents"
            expanded={open}
            onToggle={() => setOpen((v) => !v)}
            onActivate={() => onActivate('My documents')}
          >
            <Item label="Archive" selected />
            <Item label="Projects" />
          </Item>
          <Item label="Trash" />
        </ul>
        <input aria-label="rename" />
      </nav>
      <button type="button">after</button>
    </>
  );
}

const item = (name: string) => screen.getByRole('treeitem', { name });
const focused = () => document.activeElement?.getAttribute('aria-label');
const key = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });

describe('useTreeNavigation', () => {
  it('makes the selected row the only tab stop', () => {
    render(<Tree />);
    const stops = screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0);
    expect(stops.map((el) => el.getAttribute('aria-label'))).toEqual(['Archive']);
  });

  it('falls back to the first row when no row is selected', () => {
    render(<Tree />);
    fireEvent.click(item('My documents').querySelector('[data-tree-toggle]')!);
    expect(item('Home').tabIndex).toBe(0);
  });

  it('moves down and up across groups in visual order', () => {
    render(<Tree />);
    item('Inbox').focus();
    key('ArrowDown');
    expect(focused()).toBe('My documents');
    key('ArrowDown');
    expect(focused()).toBe('Archive');
    key('ArrowUp');
    key('ArrowUp');
    expect(focused()).toBe('Inbox');
  });

  it('moves the tab stop with focus while inside', () => {
    render(<Tree />);
    item('Home').focus();
    key('ArrowDown');
    expect(item('Inbox').tabIndex).toBe(0);
    expect(item('Archive').tabIndex).toBe(-1);
  });

  it('returns the tab stop to the selected row when focus leaves', () => {
    render(<Tree />);
    item('Home').focus();
    fireEvent.blur(item('Home'), { relatedTarget: screen.getByText('after') });
    expect(item('Archive').tabIndex).toBe(0);
  });

  it('jumps to the first and last rows with Home and End', () => {
    render(<Tree />);
    item('Archive').focus();
    key('End');
    expect(focused()).toBe('Trash');
    key('Home');
    expect(focused()).toBe('Home');
  });

  it('collapses with Left, then moves to the parent', () => {
    render(<Tree />);
    item('Archive').focus();
    key('ArrowLeft');
    expect(focused()).toBe('My documents');
    key('ArrowLeft');
    expect(item('My documents').getAttribute('aria-expanded')).toBe('false');
  });

  it('expands with Right, then moves to the first child', () => {
    render(<Tree />);
    item('My documents').focus();
    key('ArrowLeft');
    key('ArrowRight');
    expect(item('My documents').getAttribute('aria-expanded')).toBe('true');
    key('ArrowRight');
    expect(focused()).toBe('Archive');
  });

  it('activates the focused row with Enter and Space', () => {
    const onActivate = vi.fn();
    render(<Tree onActivate={onActivate} />);
    item('Home').focus();
    key('Enter');
    item('My documents').focus();
    key(' ');
    expect(onActivate.mock.calls).toEqual([['Home'], ['My documents']]);
  });

  it('activates only the focused row, never a child row', () => {
    const onActivate = vi.fn();
    render(<Tree onActivate={onActivate} />);
    item('My documents').focus();
    key('Enter');
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('moves to the next row starting with a typed character', () => {
    render(<Tree />);
    item('Home').focus();
    key('t');
    expect(focused()).toBe('Trash');
    key('h');
    expect(focused()).toBe('Home');
  });

  it('leaves keys typed into a field to the field', () => {
    render(<Tree />);
    const input = screen.getByRole('textbox', { name: 'rename' });
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(input);
  });

  it('ignores keys from a control inside a row', () => {
    render(<Tree />);
    const menu = item('Home').querySelector('button')!;
    menu.focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(menu);
  });
});
