// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dismissEmptyCard, emptyCardDismissed } from '@/components/canvas/empty-card-dismissed';
import { StartAgainTray } from './StartAgainTray';

// docs/specs/007-editor/start-diagramming.md "Bringing it back"
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StartAgainTray', () => {
  it('says nothing while the start is open', () => {
    render(<StartAgainTray mode="draw" tabId="t" tabName="Tab 1" />);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });

  it('without a palette strip (Drawing), offers Show Templates as a pill, which brings the start back', () => {
    dismissEmptyCard('t:draw');
    render(<StartAgainTray mode="draw" tabId="t" tabName="Tab 1" />);
    expect(screen.getByText(/Tab 1 is empty/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Templates' }));
    expect(emptyCardDismissed('t:draw')).toBe(false);
    expect(screen.queryByText(/is empty/)).toBeNull();
  });
});

describe('pillPlace', () => {
  it('stands the pill clear of Drawing’s dock: under a top dock, over a bottom one', async () => {
    const { pillPlace } = await import('./StartAgainTray');
    expect(pillPlace({ top: 12, bottom: 60 }, 900)).toEqual({ top: 70 });
    expect(pillPlace({ top: 830, bottom: 880 }, 900)).toEqual({ bottom: 80 });
    expect(pillPlace(null, 900)).toEqual({ top: 80 });
  });
});
