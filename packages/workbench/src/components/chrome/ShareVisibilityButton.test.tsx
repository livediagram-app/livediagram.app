// @vitest-environment jsdom
// The Share button wears every visibility that applies (docs/specs/007-editor/editor-app.md "Header actions", owner
// 2026-11-19): one state's hue alone, or for several a sweep across the word and the glyph, its name listing them all.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARE_SWEEP, ShareVisibilityButton, shareInk } from './ShareVisibilityButton';
import { SHARE_STATE_META, type ShareState } from './share-states';

function Button(props: {
  state: ShareState;
  states?: ShareState[];
  onOpenShare?: () => void;
  actions?: Partial<Record<ShareState, () => void>>;
}) {
  return (
    <ShareVisibilityButton
      state={props.state}
      states={props.states}
      onOpenShare={props.onOpenShare ?? (() => {})}
      actions={props.actions}
      className="corner"
    >
      <svg data-glyph="" />
      <span>Share</span>
    </ShareVisibilityButton>
  );
}

const share = () => screen.getByRole('button', { name: /^Share/ });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('one state', () => {
  it.each<[ShareState, string]>([
    ['private', 'text-emerald-700'],
    ['shared', 'text-blue-700'],
    ['team', 'text-violet-700'],
    ['community', 'text-pink-700'],
    ['offline', 'text-slate-600'],
  ])('%s words wear its own hue and no sweep', (state, ink) => {
    const { container } = render(<Button state={state} />);
    expect(share().className).toContain(ink);
    expect(share().className).not.toContain('bg-clip-text');
    expect(share().getAttribute('style')).toBeNull();
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(share().dataset.shareStates).toBe(state);
  });
});

describe('several states', () => {
  it.each<[ShareState, ShareState[], string, string[]]>([
    ['shared', ['shared', 'team'], 'Share, Shared and Team', ['text-blue-700', 'text-violet-700']],
    [
      'community',
      ['shared', 'community'],
      'Share, Shared and Public',
      ['text-blue-700', 'text-pink-700'],
    ],
    [
      'community',
      ['team', 'community'],
      'Share, Team and Public',
      ['text-violet-700', 'text-pink-700'],
    ],
    [
      'community',
      ['shared', 'team', 'community'],
      'Share, Shared, Team and Public',
      ['text-blue-700', 'text-violet-700', 'text-pink-700'],
    ],
  ])('%s leading %j sweeps the hues in ladder order', (state, states, name, stops) => {
    const { container } = render(<Button state={state} states={states} />);
    const button = screen.getByRole('button', { name });
    expect(button.dataset.shareState).toBe(state);
    expect(button.dataset.shareStates).toBe(states.join(' '));
    expect(button.className).toContain(SHARE_SWEEP[states.join(' ')]);
    expect(button.className).toContain('[&>svg]:[stroke:var(--share-sweep)]');
    // The glyph's gradient: one stop per state, in order, each in its state's ink, spread evenly.
    const gradient = container.querySelector('linearGradient')!;
    const id = gradient.getAttribute('id')!;
    expect(button.style.getPropertyValue('--share-sweep')).toBe(`url(#${id})`);
    expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
    const got = [...gradient.querySelectorAll('stop')];
    expect(got.map((s) => s.getAttribute('class')?.split(' ')[0])).toEqual(stops);
    expect(got.map((s) => Number(s.getAttribute('offset')))).toEqual(
      stops.map((_, i) => i / (stops.length - 1)),
    );
    expect(button.getAttribute('aria-description')).toBe(
      states.map((s) => SHARE_STATE_META[s].description).join(' '),
    );
  });

  it('gives each button its own gradient id', () => {
    const { container } = render(
      <>
        <Button state="shared" states={['shared', 'team']} />
        <Button state="shared" states={['shared', 'community']} />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('falls back to the leading state when the set is empty or has no sweep', () => {
    render(<Button state="team" states={[]} />);
    expect(share().className).toContain('text-violet-700');
    expect(shareInk(['private', 'offline'])).toBe('text-emerald-700 dark:text-emerald-300');
    expect(shareInk([])).toBe('text-emerald-700 dark:text-emerald-300');
  });
});

describe('the hover legend', () => {
  it('marks every state that applies, and a press opens Share', () => {
    const onOpenShare = vi.fn();
    render(<Button state="shared" states={['shared', 'team']} onOpenShare={onOpenShare} />);
    fireEvent.pointerEnter(share(), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(200));
    const legend = document.querySelector('[data-visibility-legend]')!;
    const marked = [...legend.querySelectorAll('li[data-current]')].map((li) => li.textContent);
    expect(marked).toEqual(['Shared', 'Team']);
    expect(legend.querySelector('[data-legend-hero]')?.getAttribute('data-legend-hero')).toBe(
      'all',
    );
    fireEvent.click(share());
    expect(onOpenShare).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
  });

  it('never opens for a touch, and closes a beat after the pointer leaves', () => {
    render(<Button state="team" />);
    fireEvent.pointerEnter(share(), { pointerType: 'touch' });
    act(() => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
    fireEvent.pointerEnter(share(), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-visibility-legend]')).not.toBeNull();
    fireEvent.pointerLeave(share(), { pointerType: 'touch' });
    fireEvent.pointerLeave(share(), { pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
  });

  it('keeps open while the pointer is on the legend, and its stops and Change act then close it', () => {
    const offline = vi.fn();
    const onOpenShare = vi.fn();
    render(
      <Button state="shared" states={['shared']} onOpenShare={onOpenShare} actions={{ offline }} />,
    );
    const open = () => {
      fireEvent.pointerEnter(share(), { pointerType: 'mouse' });
      act(() => void vi.advanceTimersByTime(200));
      return document.querySelector('[data-visibility-legend]')!;
    };
    const legend = open();
    const host = legend.parentElement!;
    fireEvent.pointerLeave(share(), { pointerType: 'mouse' });
    fireEvent.pointerEnter(host);
    act(() => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-visibility-legend]')).not.toBeNull();
    fireEvent.pointerLeave(host);
    act(() => void vi.advanceTimersByTime(200));
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();

    fireEvent.click(open().querySelector('li[data-stop-action]')!);
    expect(offline).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();

    open();
    fireEvent.click(screen.getByText('Change Who Can See This'));
    expect(onOpenShare).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
  });
});
