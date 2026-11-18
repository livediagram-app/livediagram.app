// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorHeader } from './EditorHeader';

// The bar over the pages that stand in for an item (docs/specs/007-editor/editor-app.md "Header actions"): the app's
// logo to the Explorer and the account control, nothing else. Each editor's door test holds its own logo and account.

function header() {
  return render(
    <EditorHeader
      app="livedocuments"
      logoHref="/explorer"
      account={<button type="button">Account menu</button>}
    />,
  );
}

describe('EditorHeader', () => {
  it('leads with the app logo, linked where the editor says, and ends with its account control', () => {
    const { container } = header();
    const logo = screen.getByRole('link', { name: 'livedocuments' });
    expect(logo.getAttribute('href')).toBe('/explorer');
    expect(logo.className).toContain('touch-target');
    const actions = container.querySelector('header > div:last-child')!;
    expect(actions.textContent).toBe('Account menu');
  });

  it('holds no title, pill or action of an open item', () => {
    const { container } = header();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Account menu']);
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('[data-header-pills]')).toBeNull();
  });
});
