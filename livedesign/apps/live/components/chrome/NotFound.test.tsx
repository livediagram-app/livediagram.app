// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound';

afterEach(() => cleanup());

// docs/specs/007-editor/new-design-route.md "Unknown addresses": the 404 card stands alone and offers its own
// ways on, the Explorer and a new design.
describe('NotFound', () => {
  it('offers Open Explorer beside New Design', () => {
    const onCreateNew = vi.fn();
    const onOpenExplorer = vi.fn();
    render(<NotFound onCreateNew={onCreateNew} onOpenExplorer={onOpenExplorer} />);
    expect(screen.getByRole('heading', { name: 'Design not found' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'New Design' }));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('names a page, not a design, for an address with no design', () => {
    render(<NotFound page onCreateNew={() => {}} onOpenExplorer={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('leaves Open Explorer out where there is nowhere to open it (an embed)', () => {
    render(<NotFound onCreateNew={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Explorer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Design' })).toBeTruthy();
  });
});
