// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EMPTY_CARD_VIEWER_LINE, EmptyCanvasArtFrame, EmptyCanvasCard } from './EmptyCanvasCard';

// liveworkspace/docs/specs/011-workbench/first-edit.md "The empty-canvas card": one card for every editor.

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const card = (tabId = 't1', help?: ReactNode) =>
  render(
    <EmptyCanvasCard
      key={tabId}
      tabId={tabId}
      tabName="Tab 1"
      line={EMPTY_CARD_VIEWER_LINE}
      art={
        <EmptyCanvasArtFrame>
          <circle cx="60" cy="36" r="8" />
        </EmptyCanvasArtFrame>
      }
      help={help}
    />,
  );

describe('the empty-canvas card', () => {
  it('names the empty tab and says its one line in full', () => {
    card();
    expect(screen.getByRole('region', { name: 'Tab 1 is empty' })).toBeTruthy();
    expect(screen.getByText('Tab 1 is empty')).toBeTruthy();
    expect(screen.getByText(EMPTY_CARD_VIEWER_LINE)).toBeTruthy();
  });

  it('drops its picture on a short screen and pads its close to a 44px tap area', () => {
    card();
    const region = screen.getByRole('region');
    const art = [...region.children].find((el) => el.tagName === 'DIV' && el.querySelector('svg'));
    expect(art?.className).toBe('[@media(max-height:480px)]:hidden');
    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(/\btouch-target\b/);
  });

  it('offers Help only when the product gives it, on a desktop', () => {
    card('t1');
    expect(screen.queryByRole('link')).toBeNull();
    cleanup();
    card('t2', <a href="/help">Help</a>);
    const help = screen.getByRole('link', { name: 'Help' });
    expect(help.parentElement!.className).toContain('phone:hidden');
  });

  it('closes for good on that tab, and nowhere else', () => {
    card('a');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region')).toBeNull();
    cleanup();
    card('a');
    expect(screen.queryByRole('region')).toBeNull();
    cleanup();
    card('b');
    expect(screen.getByRole('region')).toBeTruthy();
  });
});
