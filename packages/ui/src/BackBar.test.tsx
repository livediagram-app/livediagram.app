// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackBar, BackChevron } from './BackBar';

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
    render(<BackBar label="All Formats" current="PNG" onClick={back} />);
    const bar = screen.getByRole('button', { name: /All Formats/ });
    expect(bar.textContent).toBe('All FormatsPNG');
    fireEvent.click(bar);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const back = vi.fn();
    render(<BackBar label="All Formats" onClick={back} disabled />);
    fireEvent.click(screen.getByRole('button', { name: /All Formats/ }));
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

// back-bar.md "The header chevron": the bar's chevron alone, for a header with no room for the row.
describe('BackChevron', () => {
  it('is a button named for where it goes back to, and goes there', () => {
    const onClick = vi.fn();
    render(<BackChevron label="Back to Pages" onClick={onClick} aria-describedby="card" />);
    const button = screen.getByRole('button', { name: 'Back to Pages' });
    expect(button.getAttribute('aria-describedby')).toBe('card');
    expect(button.hasAttribute('data-back-chevron')).toBe(true);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('wears the bar well and its hover, and takes the host size', () => {
    render(<BackChevron label="Back to Ask" onClick={() => {}} className="phone:h-11" />);
    const cls = screen.getByRole('button', { name: 'Back to Ask' }).className;
    expect(cls).toMatch(/\bh-8 w-8\b/);
    expect(cls).toMatch(/\bhover:bg-brand-100\b/);
    expect(cls).toMatch(/\bfocus-visible:outline-2\b/);
    expect(cls).toMatch(/\bphone:h-11\b/);
  });

  it('keeps a 44 px press area around its 32 px well', () => {
    render(<BackChevron label="Back to Pages" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Back to Pages' });
    expect(button.className).toMatch(/\brelative\b/);
    // -inset-1.5 is 6 px each side: 32 + 12 = 44.
    const hit = button.querySelector('[data-back-chevron-hit]')!;
    expect(hit.className).toBe('absolute -inset-1.5');
  });
});
