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
    expect(screen.getByRole('heading', { name: 'Design Not Found' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'New Design' }));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('names the file in the word it is given', () => {
    render(<NotFound noun="plan" onCreateNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Plan Not Found' })).toBeTruthy();
    expect(
      screen.getByText(
        'This plan doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Plan' })).toBeTruthy();
  });

  it('tells a colleague to ask for a share link on a line of its own', () => {
    const hint =
      'If you are joining a colleague on this plan, ask them to share a URL via the Share button.';
    const { unmount } = render(<NotFound noun="plan" onCreateNew={() => {}} />);
    const line = screen.getByText(hint);
    expect(line.tagName).toBe('P');
    expect(line.previousElementSibling?.textContent).toBe(
      'This plan doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.',
    );
    unmount();
    render(<NotFound noun="plan" reason="sign-in" signInHref="/auth/sign-in" />);
    expect(screen.getByText(hint)).toBeTruthy();
  });

  it('leaves the share line off where a share link would not help', () => {
    render(<NotFound noun="plan" reason="access-ended" />);
    expect(screen.queryByText(/joining a colleague/)).toBeNull();
  });

  it('names a page, not a file, for an address with no file', () => {
    render(
      <NotFound noun="design" reason="page" onCreateNew={() => {}} onOpenExplorer={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeTruthy();
    expect(
      screen.getByText(
        'There is no page at this address. Open a design from the Explorer or start fresh.',
      ),
    ).toBeTruthy();
  });

  it('says access ended, in place of the 404', () => {
    render(<NotFound noun="plan" reason="access-ended" onCreateNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No Longer Shared With You' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
    expect(
      screen.getByText(
        'Your access to this plan was removed while you had it open. Ask its owner to share it with you again.',
      ),
    ).toBeTruthy();
  });

  it('explains a refused share link, the same for any code, with no 404', () => {
    render(
      <NotFound
        noun="canvas"
        reason="dead-link"
        onCreateNew={() => {}}
        onOpenExplorer={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Link Not Valid' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
    expect(
      screen.getByText(
        'This link isn’t valid. It may have been turned off or copied incompletely. Ask whoever shared it for a new one.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Canvas' })).toBeTruthy();
  });

  it('says an embedded item is no longer shared, with nothing to create', () => {
    render(<NotFound noun="canvas" reason="dead-link" embed onCreateNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No Longer Shared' })).toBeTruthy();
    expect(
      screen.getByText(
        'This canvas is no longer shared at this link. Ask whoever shared it for a new one.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a signed-out visitor Sign In, back to the same address, in place of New', () => {
    render(
      <NotFound
        noun="canvas"
        reason="sign-in"
        signInHref="/sign-in/?redirect_url=%2Fdocument%2Fd1"
        onCreateNew={() => {}}
        onOpenExplorer={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Canvas Not Found' })).toBeTruthy();
    expect(screen.getByText('404')).toBeTruthy();
    expect(
      screen.getByText('This canvas doesn’t exist, or you don’t have access to it.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe(
      '/sign-in/?redirect_url=%2Fdocument%2Fd1',
    );
    expect(screen.queryByRole('button', { name: 'New Canvas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Explorer' })).toBeTruthy();
  });

  it('keeps New when the sign-in case has nowhere to sign in', () => {
    render(<NotFound noun="canvas" reason="sign-in" onCreateNew={() => {}} />);
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Canvas' })).toBeTruthy();
  });

  it('shows no button row when it has no way on', () => {
    render(<NotFound noun="canvas" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('leaves Open Explorer out where there is nowhere to open it (an embed)', () => {
    render(<NotFound noun="design" onCreateNew={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Explorer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Design' })).toBeTruthy();
  });

  it('says the file is archived, with Change Folder and Open Explorer, and no 404', () => {
    const onChangeFolder = vi.fn();
    const onOpenExplorer = vi.fn();
    render(
      <NotFound
        noun="design"
        archived={{ onChangeFolder }}
        onCreateNew={() => {}}
        onOpenExplorer={onOpenExplorer}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Design Archived' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
    expect(
      screen.getByText(
        'This design is archived, so it can’t be opened or edited. Move it out of Archived with Change Folder to work on it again.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Design' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change Folder' }));
    expect(onChangeFolder).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
  });

  it('offers only Open Explorer for an archived file in an embed', () => {
    render(<NotFound noun="plan" archived={{}} onCreateNew={() => {}} onOpenExplorer={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Plan Archived' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change Folder' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Explorer' })).toBeTruthy();
  });

  it('offers nothing to press for an archived file where there is nowhere to go', () => {
    render(<NotFound noun="plan" archived={{}} onCreateNew={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
