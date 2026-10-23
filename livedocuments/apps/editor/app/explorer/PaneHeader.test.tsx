// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaneHeader } from './PaneHeader';

// Help and Create always sit right of the List / Card / Details toggle
// (docs/specs/006-document/document-snapshots.md).
describe('PaneHeader', () => {
  it('puts Help and Create after the view toggle', () => {
    const { container } = render(
      <PaneHeader
        title="My Work"
        crumbs={[]}
        onCreateDocument={() => {}}
        onCreateFolder={() => {}}
        folderLabel="New folder"
        helpArticle="sharing"
        viewMode="card"
        onSetViewMode={() => {}}
      />,
    );
    const toggle = screen.getByRole('group', { name: 'View mode' });
    const help = container.querySelector('a[href*="sharing"]')!;
    expect(help).not.toBeNull();
    const create = screen.getByRole('button', { name: /create/i });
    for (const after of [help, create]) {
      expect(toggle.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
