// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCurrentPageKind } from '@/lib/current-page-kind';
import { PageNavigatorClusterStrip } from './PageNavigatorClusterStrip';

// docs/specs/007-editor/pages-mode.md "Getting around the pages".
describe('PageNavigatorClusterStrip', () => {
  afterEach(() => {
    cleanup();
    act(() => setCurrentPageKind(null, null));
  });

  it('shows the place of the page someone is on and goes to its neighbours', () => {
    const onGo = vi.fn();
    act(() => setCurrentPageKind('slide', 'b'));
    render(<PageNavigatorClusterStrip pageIds={['a', 'b', 'c']} onGo={onGo} />);
    expect(screen.getByRole('group', { name: 'Page 2 of 3' }).textContent).toContain('2 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onGo).toHaveBeenLastCalledWith('c');
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onGo).toHaveBeenLastCalledWith('a');
  });

  it('stops at the ends, and starts on the first page before one is known', () => {
    render(<PageNavigatorClusterStrip pageIds={['a', 'b']} onGo={() => {}} />);
    expect(screen.getByRole('group', { name: 'Page 1 of 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(
      true,
    );
    act(() => setCurrentPageKind('slide', 'b'));
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
  });
});
