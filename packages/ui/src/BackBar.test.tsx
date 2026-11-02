// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackBar } from './BackBar';

// docs/specs/004-interface-design/back-bar.md: the one back bar every app draws. "Always in view": it sticks to
// the top of its scroller, flush with its edge, in every host.
afterEach(cleanup);

describe('BackBar stays in view', () => {
  it('is sticky in both forms', () => {
    render(
      <>
        <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
        <BackBar label="Choose a Space" />
      </>,
    );
    expect(screen.getByRole('button', { name: /Tab Style/ }).className).toMatch(/\bsticky top-0\b/);
    expect(screen.getByText('Choose a Space').parentElement!.className).toMatch(/\bsticky top-0\b/);
  });

  it('lifts itself by the scroller top padding, so nothing shows above it once stuck', () => {
    render(
      <div style={{ overflowY: 'auto', paddingTop: '8px' }}>
        <div>
          <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
        </div>
      </div>,
    );
    expect(screen.getByRole('button', { name: /Tab Style/ }).style.top).toBe('-8px');
  });

  it('keeps top 0 when a clipping box sits between it and the scroller', () => {
    render(
      <div style={{ overflowY: 'auto', paddingTop: '20px' }}>
        <div style={{ overflowY: 'hidden' }}>
          <BackBar label="Choose a Space" />
        </div>
      </div>,
    );
    expect(screen.getByText('Choose a Space').parentElement!.style.top).toBe('');
  });

  it('keeps top 0 with no scroller above it', () => {
    render(<BackBar label="Tab Style" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Tab Style/ }).style.top).toBe('');
  });
});

describe('BackBar as the way back', () => {
  it('names where it goes back to, with where you are as its chip', () => {
    const back = vi.fn();
    render(<BackBar label="All formats" current="PNG" onClick={back} />);
    const bar = screen.getByRole('button', { name: /All formats/ });
    expect(bar.textContent).toBe('All formatsPNG');
    fireEvent.click(bar);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const back = vi.fn();
    render(<BackBar label="All formats" onClick={back} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /All formats/ }));
    expect(back).not.toHaveBeenCalled();
  });

  it('keeps focus where it is when asked, so a combobox list stays open', () => {
    render(
      <>
        <BackBar label="All events" onClick={() => {}} keepFocus />
        <BackBar label="Tab Style" onClick={() => {}} />
      </>,
    );
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: /All events/ }))).toBe(false);
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: /Tab Style/ }))).toBe(true);
  });
});
