// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound';

afterEach(() => cleanup());

// docs/specs/007-editor/new-document-route.md "Unknown addresses": the 404 card stands alone and offers its own
// ways on, the Explorer and a new document.
describe('NotFound', () => {
  it('offers Open Explorer beside New Canvas', () => {
    const onCreateNew = vi.fn();
    const onOpenExplorer = vi.fn();
    render(<NotFound onCreateNew={onCreateNew} onOpenExplorer={onOpenExplorer} />);
    expect(screen.getByRole('heading', { name: 'Canvas not found' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'New Canvas' }));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('names a page, not a document, for an address with no document', () => {
    render(<NotFound page onCreateNew={() => {}} onOpenExplorer={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('leaves Open Explorer out where there is nowhere to open it (an embed)', () => {
    render(<NotFound onCreateNew={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Open Explorer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Canvas' })).toBeTruthy();
  });

  it('says the canvas is archived, with Change Folder and Open Explorer', () => {
    const onChangeFolder = vi.fn();
    render(
      <NotFound archived={{ onChangeFolder }} onCreateNew={() => {}} onOpenExplorer={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Canvas Archived' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Canvas' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change Folder' }));
    expect(onChangeFolder).toHaveBeenCalledOnce();
  });
});
