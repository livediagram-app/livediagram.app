// @vitest-environment jsdom
// The visibility legend marks every state that applies (docs/specs/007-editor/editor-app.md "Header actions", owner
// 2026-11-19): each stop filled in its own hue, the track to the widest, the hero naming them together.
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisibilityLegend } from './VisibilityLegend';
import type { ShareState } from './share-states';

function stops(container: HTMLElement) {
  return [...container.querySelectorAll('ol > li')] as HTMLElement[];
}
const marked = (container: HTMLElement) =>
  stops(container)
    .filter((li) => li.hasAttribute('data-current'))
    .map((li) => li.textContent);
const fill = (container: HTMLElement) =>
  (container.querySelector('ol')!.previousElementSibling!.firstElementChild as HTMLElement).style
    .width;
const hero = (container: HTMLElement) =>
  container.querySelector('[data-legend-hero]')!.getAttribute('data-legend-hero');
const visibleHeroText = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-legend-hero] .grid > div')]
    .filter((d) => !d.classList.contains('invisible'))
    .map((d) => d.textContent);

describe('one state', () => {
  it.each<[ShareState, string, string]>([
    ['offline', 'Offline', '0%'],
    ['private', 'Private', '25%'],
    ['shared', 'Shared', '50%'],
    ['team', 'Team', '75%'],
    ['community', 'Everyone', '100%'],
  ])('%s marks its stop alone and fills to it', (state, stop, width) => {
    const { container } = render(<VisibilityLegend current={state} />);
    expect(marked(container)).toEqual([stop]);
    expect(fill(container)).toBe(width);
    expect(hero(container)).toBe(state);
    expect(container.querySelector('[data-legend-together]')).toBeNull();
  });
});

describe('several states', () => {
  it.each<[ShareState[], string[], string, string]>([
    [['shared', 'team'], ['Shared', 'Team'], '75%', 'Shared and Team'],
    [['shared', 'community'], ['Shared', 'Everyone'], '100%', 'Shared and Public'],
    [['team', 'community'], ['Team', 'Everyone'], '100%', 'Team and Public'],
    [
      ['shared', 'team', 'community'],
      ['Shared', 'Team', 'Everyone'],
      '100%',
      'Shared, Team and Public',
    ],
  ])(
    '%j marks every stop, fills to the widest and names them together',
    (states, want, width, name) => {
      const { container } = render(<VisibilityLegend current={states[0]!} states={states} />);
      expect(marked(container)).toEqual(want);
      expect(fill(container)).toBe(width);
      expect(hero(container)).toBe('all');
      const together = container.querySelector('[data-legend-together]')!;
      expect(together.classList.contains('invisible')).toBe(false);
      expect(together.textContent).toContain('Who Can See This');
      expect(together.textContent).toContain(name);
      // One sentence per state that applies.
      expect(together.querySelectorAll('li')).toHaveLength(states.length);
      // Each marked stop wears its own hue (the solid fill), not one shared colour.
      const solids = stops(container)
        .filter((li) => li.hasAttribute('data-current'))
        .map((li) => /bg-(\w+)-600/.exec(li.firstElementChild!.className)?.[1]);
      expect(new Set(solids).size).toBe(states.length);
    },
  );

  it('hovering a stop that applies shows it as current, any other as If It Were, and leaving brings them back', () => {
    const { container } = render(<VisibilityLegend current="shared" states={['shared', 'team']} />);
    const [, priv, , team] = stops(container);
    fireEvent.mouseEnter(team!);
    expect(hero(container)).toBe('team');
    expect(visibleHeroText(container)[0]).toMatch(/^Who Can See This/);
    fireEvent.mouseEnter(priv!);
    expect(hero(container)).toBe('private');
    expect(visibleHeroText(container)[0]).toMatch(/^If It Were/);
    fireEvent.mouseLeave(container.querySelector('ol')!);
    expect(hero(container)).toBe('all');
  });

  it('runs only the actions of stops that do not apply', () => {
    const shared = vi.fn();
    const offline = vi.fn();
    const { container } = render(
      <VisibilityLegend
        current="shared"
        states={['shared', 'team']}
        actions={{ shared, offline }}
      />,
    );
    const [off, , link] = stops(container);
    fireEvent.click(link!);
    expect(shared).not.toHaveBeenCalled();
    fireEvent.click(off!);
    expect(offline).toHaveBeenCalledOnce();
  });

  it('an empty set falls back to the leading state', () => {
    const { container } = render(<VisibilityLegend current="team" states={[]} />);
    expect(marked(container)).toEqual(['Team']);
  });
});
