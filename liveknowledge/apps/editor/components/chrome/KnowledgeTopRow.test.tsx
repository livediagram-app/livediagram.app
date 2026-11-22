// @vitest-environment jsdom

// The top row every view shares (docs/specs/030-knowledgebase/page-surface.md "The footer"): Share and the account
// button are drawn once, into the slot of the row on top.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@liveworkspace/workbench/components/chrome/AuthControls', () => ({
  AuthControls: () => <button type="button">Account</button>,
}));
vi.mock('@liveworkspace/workbench/components/chrome/ShareVisibilityButton', () => ({
  ShareVisibilityButton: ({ onOpenShare }: { onOpenShare: () => void }) => (
    <button type="button" onClick={onOpenShare}>
      Share
    </button>
  ),
}));

import { topRowSlot } from '@/lib/page-surface/top-row-slot';
import { KnowledgeTopRow } from './KnowledgeTopRow';
import { TopRowActions, type TopRowActionsProps } from './TopRowActions';

afterEach(cleanup);

const actions = (over: Partial<TopRowActionsProps> = {}) => (
  <TopRowActions
    showShare
    shareable={false}
    visibility={{}}
    onOpenShare={() => {}}
    copying={false}
    onOpenAccount={() => {}}
    {...over}
  />
);
const rowOf = (name: string) =>
  screen.getByRole('button', { name }).closest('[data-knowledge-top-row]');

describe('the top row', () => {
  it('holds its own controls at the left and Share and the account button at its right end', () => {
    render(
      <>
        <KnowledgeTopRow rank="page" leading={<button type="button">Menu</button>}>
          <button type="button">Bold</button>
        </KnowledgeTopRow>
        {actions()}
      </>,
    );
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Menu', 'Bold', 'Share', 'Account']);
    expect(rowOf('Share')?.getAttribute('data-knowledge-top-row')).toBe('page');
    // The same height in every view, from one variable.
    expect(rowOf('Share')?.getAttribute('style')).toContain('var(--knowledge-top-row)');
  });

  it('moves the two buttons to a view drawn over the page, and back when it goes', () => {
    const page = (
      <KnowledgeTopRow rank="page">
        <span>Formatting</span>
      </KnowledgeTopRow>
    );
    const { rerender } = render(
      <>
        {page}
        <KnowledgeTopRow rank="view">
          <span>Ask</span>
        </KnowledgeTopRow>
        {actions()}
      </>,
    );
    expect(rowOf('Share')?.getAttribute('data-knowledge-top-row')).toBe('view');
    expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1);
    rerender(
      <>
        {page}
        {actions()}
      </>,
    );
    expect(rowOf('Account')?.getAttribute('data-knowledge-top-row')).toBe('page');
  });

  it('draws nothing while no row shows (zen, an embed)', () => {
    render(actions());
    expect(topRowSlot()).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a visitor Make a Copy in Share’s place', () => {
    render(
      <>
        <KnowledgeTopRow rank="page" />
        {actions({ showShare: false, onMakeCopy: () => {} })}
      </>,
    );
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});
