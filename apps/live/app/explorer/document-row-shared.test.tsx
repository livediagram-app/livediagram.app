// @vitest-environment jsdom

// The document menu's Delete is an ordinary verb now: a delete goes to the
// Trash for 30 days (docs/specs/013-workspace/trash.md), so it is not painted red.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentActionsMenu } from './document-row-shared';
import type { PaneDocument } from './views';

afterEach(cleanup);

const DOC = { id: 'd', name: 'Plan', ownerId: 'me', savedAt: 1 } as unknown as PaneDocument;

describe('DocumentActionsMenu', () => {
  it('offers Delete in the ordinary colour, not red', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    render(
      <DocumentActionsMenu
        document={DOC}
        anchor={anchor}
        ownerId="me"
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const del = screen.getByRole('menuitem', { name: 'Delete' });
    expect(del.className).not.toMatch(/rose|red/);
    expect(del.innerHTML).not.toMatch(/rose|red-/);
  });
});
