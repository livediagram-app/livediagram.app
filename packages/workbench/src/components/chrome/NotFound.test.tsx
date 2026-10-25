// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound';

afterEach(() => cleanup());

// The new-file route spec's "Unknown addresses": the 404 card stands alone and offers its own
// ways on, the Explorer and a new file, named in the product's word.
describe('NotFound', () => {
  it('offers Open Explorer beside New Design', () => {
    const onCreateNew = vi.fn();
    const onOpenExplorer = vi.fn();
    render(<NotFound noun="design" onCreateNew={onCreateNew} onOpenExplorer={onOpenExplorer} />);
    expect(screen.getByRole('heading', { name: 'Design not found' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'New Design' }));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('names the file in the word it is given', () => {
    render(<NotFound noun="plan" onCreateNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Plan not found' })).toBeTruthy();
    expect(
      screen.getByText(
        'This plan doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Plan' })).toBeTruthy();
  });

  it('names a page, not a file, for an address with no file', () => {
    render(<NotFound noun="design" page onCreateNew={() => {}} onOpenExplorer={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(
      screen.getByText(
        'There is no page at this address. Open a design from the Explorer or start fresh.',
      ),
    ).toBeTruthy();
  });

  it('says access ended, in place of the 404', () => {
    render(<NotFound noun="plan" accessEnded onCreateNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No Longer Shared With You' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
    expect(
      screen.getByText(
        'Your access to this plan was removed while you had it open. Ask its owner to share it with you again.',
      ),
    ).toBeTruthy();
  });

  it('leaves Open Explorer out where there is nowhere to open it (an embed)', () => {
    render(<NotFound noun="design" onCreateNew={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Explorer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Design' })).toBeTruthy();
  });
});
