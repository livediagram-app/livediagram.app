// @vitest-environment jsdom

// A sidebar group's title or separator (docs/specs/013-workspace/explorer-structure.md#group-titles-and-separators).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarGroup } from './SidebarGroup';

afterEach(cleanup);

const group = (divider: 'titles' | 'separators', first = false) =>
  render(
    <SidebarGroup id="spaces" divider={divider} first={first}>
      <li role="treeitem" aria-selected={false} aria-label="My documents" />
    </SidebarGroup>,
  );

describe('SidebarGroup', () => {
  it('opens with its visible title when titles are shown', () => {
    group('titles');
    const title = screen.getByRole('heading', { name: 'Spaces' });
    expect(title.querySelector('.sr-only')).toBeNull();
    expect(document.querySelector('[data-sidebar-separator]')).toBeNull();
  });

  it('shows a hairline instead of the title when separators are shown', () => {
    group('separators');
    expect(document.querySelector('[data-sidebar-separator]')).not.toBeNull();
    const hidden = screen.getByRole('heading', { name: 'Spaces' }).querySelector('.sr-only');
    expect(hidden?.textContent).toBe('Spaces');
  });

  it('keeps the same heading box in both modes, so nothing moves', () => {
    group('titles');
    const titled = screen.getByRole('heading').className;
    cleanup();
    group('separators');
    expect(screen.getByRole('heading').className).toBe(titled);
  });

  it('draws no hairline above the first group', () => {
    group('separators', true);
    expect(document.querySelector('[data-sidebar-separator]')).toBeNull();
  });

  it('names its tree by its title in both modes', () => {
    group('separators');
    expect(screen.getByRole('tree', { name: 'Spaces' })).toBeTruthy();
    cleanup();
    group('titles');
    expect(screen.getByRole('tree', { name: 'Spaces' })).toBeTruthy();
  });

  it('places a trailing item after its tree, outside it', () => {
    render(
      <SidebarGroup id="spaces" divider="titles" after={<a href="/sign-in/">Sign in</a>}>
        <li role="treeitem" aria-selected={false} aria-label="My documents" />
      </SidebarGroup>,
    );
    const tree = screen.getByRole('tree');
    expect(tree.contains(screen.getByRole('link'))).toBe(false);
  });
});
