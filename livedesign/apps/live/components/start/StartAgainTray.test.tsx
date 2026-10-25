// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissEmptyCard,
  emptyCardDismissed,
} from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { StartAgainTray } from './StartAgainTray';

// docs/specs/007-editor/start-diagramming.md "Bringing it back"
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StartAgainTray', () => {
  it('says nothing while the start is open', () => {
    render(<StartAgainTray mode="pages" tabId="t" tabName="Tab 1" />);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });

  it('without a palette strip, offers Show Templates as a pill, which brings the start back', () => {
    dismissEmptyCard('t:pages');
    render(<StartAgainTray mode="pages" tabId="t" tabName="Tab 1" />);
    expect(screen.getByText(/Tab 1 is empty/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Templates' }));
    expect(emptyCardDismissed('t:pages')).toBe(false);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });
});
