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
        label="My Documents"
        textLabel="My Documents"
        selected={false}
        onActivate={() => {}}
        depth={0}
        {...props}
      />
    </ul>,
  );

const gutterOf = (el: HTMLElement) => el.querySelector('[data-tree-toggle]');

describe('SidebarRow', () => {
  // docs/specs/013-workspace/explorer-structure.md "Look".
  it('carries its icon on a tile in its tone, and a bare icon without one', () => {
    row({ tone: 'violet' });
    const tile = screen.getByRole('treeitem').querySelector('[data-sidebar-tile]')!;
    expect(tile.getAttribute('data-sidebar-tile')).toBe('violet');
    expect(tile.className).toContain('bg-violet-100');
    expect(tile.querySelector('[data-testid="icon"]')).not.toBeNull();
    cleanup();
    row();
    expect(screen.getByRole('treeitem').querySelector('[data-sidebar-tile]')).toBeNull();
  });

  it('raises the current row into a white pill with a solid brand-rose tile', () => {
    row({ tone: 'sky', selected: true });
    const line = screen.getByRole('treeitem').querySelector('[data-tree-row]')!;
    expect(line.className).toContain('bg-white');
    expect(line.className).toContain('border-rose-200');
    expect(screen.getByRole('treeitem').querySelector('[data-sidebar-tile]')!.className).toContain(
      'bg-rose-700',
    );
  });

  it('keeps a transparent edge at rest, so selecting moves nothing', () => {
    row();
    const line = screen.getByRole('treeitem').querySelector('[data-tree-row]')!;
    expect(line.className).toMatch(/\bborder\b/);
    expect(line.className).toContain('border-transparent');
  });

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
    const item = screen.getByRole('treeitem', { name: 'My Documents' });
    expect(item.getAttribute('aria-level')).toBe('2');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(item.dataset.treeLabel).toBe('My Documents');
  });

  it('carries aria-expanded only when it can expand', () => {
    row();
    expect(screen.getByRole('treeitem').hasAttribute('aria-expanded')).toBe(false);
    cleanup();
    row({ expandable: true, expanded: true, onToggleExpand: () => {} });
    expect(screen.getByRole('treeitem').getAttribute('aria-expanded')).toBe('true');
  });

  it('renders its children in a group only while expanded', () => {
    const child = <li role="treeitem" aria-selected={false} aria-label="Archive" />;
    row({ expandable: true, expanded: false, onToggleExpand: () => {}, children: child });
    expect(screen.queryByRole('group')).toBeNull();
    cleanup();
    row({ expandable: true, expanded: true, onToggleExpand: () => {}, children: child });
    expect(screen.getByRole('group').textContent).toBe('');
    expect(screen.getByRole('treeitem', { name: 'Archive' })).toBeTruthy();
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
    fireEvent.click(screen.getByText('My Documents'));
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

describe('SidebarRow extras', () => {
  it('describes itself to assistive technology when given a sentence', () => {
    row({ description: 'Lives only in this browser.' });
    const item = screen.getByRole('treeitem');
    const id = item.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe('Lives only in this browser.');
  });

  it('spreads drag handlers onto its own line and rings while highlighted', () => {
    const onDragStart = vi.fn();
    row({ rowProps: { draggable: true, onDragStart }, highlighted: true });
    const line = screen.getByRole('treeitem').querySelector('[data-tree-row]') as HTMLElement;
    expect(line.getAttribute('draggable')).toBe('true');
    expect(line.className).toMatch(/ring-brand-400/);
    fireEvent.dragStart(line);
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/004-interface-design/touch-targets.md: on a touch screen a row is 44px tall and its
// chevron is a 44px disclosure at the row's end, the row's full height, so a thumb lands on the row it
// means; its words read at 15px on a 20px line, so 12px of padding each side makes the 44px.
describe('SidebarRow on a touch screen', () => {
  it('grows the row to 44px and moves the chevron to its end, the full row height', () => {
    row({ expandable: true, expanded: false, onToggleExpand: () => {} });
    const item = screen.getByRole('treeitem');
    const activate = item.querySelector('[data-tree-activate]')!.className;
    expect(activate).toMatch(/\bpointer-coarse:py-3\b/);
    expect(activate).toMatch(/\bpointer-coarse:text-\[15px\]/);
    expect(activate).toMatch(/\bleading-5\b/);
    const gutter = gutterOf(item)!;
    expect(gutter.className).toMatch(/\bpointer-coarse:self-stretch\b/);
    expect(gutter.className).toMatch(/\bpointer-coarse:w-11\b/);
    expect(gutter.className).toMatch(/\bpointer-coarse:order-last\b/);
    expect(gutter.className).not.toMatch(/\bpointer-coarse:hidden\b/);
  });

  // docs/specs/013-workspace/explorer-structure.md#alignment: no gutter on a touch screen, so a plain
  // row's icon sits under its group's title instead of behind an empty thumb-sized gap.
  it('reserves no gutter on a row that cannot expand', () => {
    row();
    expect(gutterOf(screen.getByRole('treeitem'))!.className).toMatch(/\bpointer-coarse:hidden\b/);
  });
});
