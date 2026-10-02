// @vitest-environment jsdom

// One sidebar row (docs/specs/013-workspace/explorer-structure.md#alignment and #keyboard-and-aria).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarRow } from './SidebarRow';

afterEach(cleanup);

const row = (props: Partial<React.ComponentProps<typeof SidebarRow>> = {}) =>
  render(
    <ul role="tree" aria-label="Spaces">
      <SidebarRow
        icon={<svg data-testid="icon" />}
        label="My documents"
        textLabel="My documents"
        selected={false}
        onActivate={() => {}}
        depth={0}
        {...props}
      />
    </ul>,
  );

const gutterOf = (el: HTMLElement) => el.querySelector('[data-tree-toggle]');

describe('SidebarRow', () => {
  it('reserves the chevron gutter on a row that cannot expand', () => {
    row();
    const gutter = gutterOf(screen.getByRole('treeitem'));
    expect(gutter).not.toBeNull();
    expect(gutter?.className).toMatch(/\bw-5\b/);
  });

  it('puts the gutter before the icon on every row, expandable or not', () => {
    row({ expandable: true, expanded: false, onToggleExpand: () => {} });
    const line = screen.getByRole('treeitem').querySelector('[data-tree-row]')!;
    const [first] = [...line.children];
    expect(first?.hasAttribute('data-tree-toggle')).toBe(true);
  });

  it('is a treeitem with its level, selection and label', () => {
    row({ depth: 1, selected: true });
    const item = screen.getByRole('treeitem', { name: 'My documents' });
    expect(item.getAttribute('aria-level')).toBe('2');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(item.dataset.treeLabel).toBe('My documents');
  });

  it('carries aria-expanded only when it can expand', () => {
    row();
    expect(screen.getByRole('treeitem').hasAttribute('aria-expanded')).toBe(false);
    cleanup();
    row({ expandable: true, expanded: true, onToggleExpand: () => {} });
    expect(screen.getByRole('treeitem').getAttribute('aria-expanded')).toBe('true');
  });

  it('renders its children in a group only while expanded', () => {
    const child = <li role="treeitem" aria-selected={false} aria-label="Unsorted" />;
    row({ expandable: true, expanded: false, onToggleExpand: () => {}, children: child });
    expect(screen.queryByRole('group')).toBeNull();
    cleanup();
    row({ expandable: true, expanded: true, onToggleExpand: () => {}, children: child });
    expect(screen.getByRole('group').textContent).toBe('');
    expect(screen.getByRole('treeitem', { name: 'Unsorted' })).toBeTruthy();
  });

  it('toggles from the chevron without activating', () => {
    const onActivate = vi.fn();
    const onToggleExpand = vi.fn();
    row({ expandable: true, expanded: false, onToggleExpand, onActivate });
    fireEvent.click(gutterOf(screen.getByRole('treeitem'))!);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('activates from its label', () => {
    const onActivate = vi.fn();
    row({ onActivate });
    fireEvent.click(screen.getByText('My documents'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('does not activate from a trailing control', () => {
    const onActivate = vi.fn();
    row({ onActivate, trailing: <button type="button">menu</button> });
    fireEvent.click(screen.getByRole('button', { name: 'menu' }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('keeps its context menu from reaching an ancestor row', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <ul role="tree" aria-label="Spaces">
        <SidebarRow
          icon={null}
          label="Parent"
          textLabel="Parent"
          selected={false}
          onActivate={() => {}}
          depth={0}
          expandable
          expanded
          onToggleExpand={() => {}}
          onContextMenu={outer}
        >
          <SidebarRow
            icon={null}
            label="Child"
            textLabel="Child"
            selected={false}
            onActivate={() => {}}
            depth={1}
            onContextMenu={inner}
          />
        </SidebarRow>
      </ul>,
    );
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'Child' }));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
