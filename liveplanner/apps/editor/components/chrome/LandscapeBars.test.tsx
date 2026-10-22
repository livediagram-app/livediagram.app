// @vitest-environment jsdom
// The fold round the header and the tab bar, and the bars handle (docs/specs/007-editor/editor-app.md
// "A phone held sideways"). The fold is CSS: these lock the classes and attributes the
// `landscape-phone:` variant acts on; the media query itself is locked in lib/responsive.test.ts.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HIDE_BARS_LABEL,
  LandscapeBarFold,
  LandscapeBarsHandle,
  SHOW_BARS_LABEL,
} from './LandscapeBars';

afterEach(cleanup);

describe('LandscapeBarFold', () => {
  it('folded, hides on a phone held sideways unless focus is inside, and is layout-neutral elsewhere', () => {
    render(
      <LandscapeBarFold shown={false}>
        <header>Bar</header>
      </LandscapeBarFold>,
    );
    const fold = screen.getByText('Bar').parentElement!;
    expect(fold.getAttribute('data-landscape-bar')).toBe('folded');
    expect(fold.className.split(' ')).toEqual([
      'contents',
      'landscape-phone:not-focus-within:hidden',
    ]);
  });

  it('shown, never hides', () => {
    render(
      <LandscapeBarFold shown>
        <header>Bar</header>
      </LandscapeBarFold>,
    );
    const fold = screen.getByText('Bar').parentElement!;
    expect(fold.getAttribute('data-landscape-bar')).toBe('shown');
    expect(fold.className).toBe('contents');
  });
});

describe('LandscapeBarsHandle', () => {
  it('is drawn only on a phone held sideways, in a zero-height row', () => {
    const { container } = render(<LandscapeBarsHandle shown={false} onToggle={() => {}} />);
    const row = container.firstElementChild!;
    expect(row.className).toContain('hidden');
    expect(row.className).toContain('landscape-phone:block');
    expect(row.className).toContain('h-0');
  });

  it('offers to show the bars while they are folded, and toggles on a press', () => {
    const onToggle = vi.fn();
    render(<LandscapeBarsHandle shown={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: SHOW_BARS_LABEL });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers to hide them while they show', () => {
    render(<LandscapeBarsHandle shown onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: HIDE_BARS_LABEL });
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('clears a landscape notch and, folded, the status bar', () => {
    const { container, rerender } = render(
      <LandscapeBarsHandle shown={false} onToggle={() => {}} />,
    );
    const card = () => container.querySelector<HTMLElement>('[data-landscape-bars-handle]')!;
    expect(card().getAttribute('style')).toContain('env(safe-area-inset-right');
    expect(card().getAttribute('style')).toContain('env(safe-area-inset-top');
    rerender(<LandscapeBarsHandle shown onToggle={() => {}} />);
    // Under the header, which clears the top inset itself.
    expect(card().getAttribute('style')).not.toContain('safe-area-inset-top');
  });
});
