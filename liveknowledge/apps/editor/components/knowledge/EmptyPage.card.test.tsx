// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { EmptyPage } from './EmptyPage';

// An empty page's read state beside the empty-canvas card (docs/specs/007-editor/new-document-route.md "The
// empty-canvas hint"): a reader of the untouched page /new made sees the card alone, never both empty states; once the
// card is closed, the page's own line is back. An Editor keeps Start Writing whatever the card does.

const chrome = vi.hoisted(() => ({
  state: {
    activeTab: { id: 't1' },
    pageTab: { id: 't1', articles: {} },
    pageEditing: { editing: false, mayEdit: false, start: () => {} },
    cardShown: true,
  },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChrome: (pick: (s: unknown) => unknown) => pick(chrome.state),
  useEditorChromeStore: () => ({ get: () => chrome.state }),
}));
vi.mock('@/components/start/useTemplateStartShown', () => ({
  emptyCardShownOf: (s: { cardShown: boolean }) => s.cardShown,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const set = (mayEdit: boolean, cardShown: boolean) => {
  chrome.state.pageEditing.mayEdit = mayEdit;
  chrome.state.cardShown = cardShown;
};

describe('EmptyPage beside the empty-canvas card', () => {
  it("hides a reader's empty state while the card is up, and brings it back once the card is closed", () => {
    set(false, true);
    render(<EmptyPage />);
    expect(screen.queryByText('Nothing Written Yet')).toBeNull();
    act(() => dismissEmptyCard('t1'));
    expect(screen.getByText('This page has no writing yet. Check back soon.')).toBeTruthy();
  });

  it("shows a reader's empty state on a page the card does not cover", () => {
    set(false, false);
    render(<EmptyPage />);
    expect(screen.getByText('This page has no writing yet. Check back soon.')).toBeTruthy();
  });

  it('keeps Start Writing for an Editor', () => {
    set(true, true);
    render(<EmptyPage />);
    expect(screen.getByRole('button', { name: 'Start Writing' })).toBeTruthy();
  });
});
