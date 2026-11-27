// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { automaticPresenceColour } from '@liveworkspace/settings/presence';
import { PageMakersStackView, STACK_MAX, makersOf } from './PageMakersStack';
import { Disc } from './PageHealthCard';

afterEach(cleanup);

const names: Record<string, string> = { u1: 'Priya Shah', u2: 'Sam Lee' };
const nameOf = (id: string | undefined) => (id ? names[id] : undefined);

describe('who made the page, in the top row', () => {
  it('names the creator first, then the editors; an agent for its person, an unknown person as Guest', () => {
    const makers = makersOf(
      [
        { by: 'u1', at: 1, kind: 'human' },
        { by: 'u1', at: 2, kind: 'ai', agent: 'Claude' },
        { by: 'g9', at: 3, kind: 'human' },
      ],
      nameOf,
    );
    expect(makers.map((m) => `${m.name}, ${m.role}`)).toEqual([
      'Priya Shah, Created',
      'Claude for Priya Shah, Edited',
      'Guest, Edited',
    ]);
    render(<PageMakersStackView makers={makers} />);
    expect(screen.getByRole('img', { name: 'Priya Shah, Created' }).textContent).toBe('PS');
    expect(screen.getByRole('img', { name: 'Claude for Priya Shah, Edited' })).toBeTruthy();
  });

  it('counts the rest past the row in a last disc', () => {
    const many = Array.from({ length: STACK_MAX + 3 }, (_, i) => ({
      by: `x${i}`,
      at: i,
      kind: 'human' as const,
    }));
    render(<PageMakersStackView makers={makersOf(many, () => 'Someone Here')} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(STACK_MAX);
    expect(screen.getByRole('img', { name: 'And 4 more' }).textContent).toBe('+4');
  });

  it('draws nothing with nobody known', () => {
    const { container } = render(<PageMakersStackView makers={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('every person wears their presence colour (Work Tracker 1497)', () => {
  it('in the top row: their own colour, else the Automatic one from their name; never on an agent or a guest', () => {
    const makers = makersOf(
      [
        { by: 'u1', at: 1, kind: 'human' },
        { by: 'u2', at: 2, kind: 'human' },
        { by: 'u1', at: 3, kind: 'ai', agent: 'Claude' },
        { by: 'g9', at: 4, kind: 'human' },
      ],
      nameOf,
      { u1: '#ec4899' },
    );
    expect(makers.map((m) => m.color)).toEqual([
      '#ec4899',
      automaticPresenceColour('Sam Lee').value,
      undefined,
      undefined,
    ]);
    render(<PageMakersStackView makers={makers} />);
    const priya = screen.getByRole('img', { name: 'Priya Shah, Created' });
    expect(priya.style.getPropertyValue('--identity')).toBe('#ec4899');
    expect(priya.className).toContain('bg-(--identity)');
    expect(
      screen.getByRole('img', { name: 'Guest, Edited' }).style.getPropertyValue('--identity'),
    ).toBe('');
  });

  it("in the rail's discs: their colour, the Automatic one without it, a guest's figure, and '?' with no name", () => {
    const { container, rerender } = render(<Disc name="Priya Shah" color="#ec4899" />);
    const disc = () => container.firstElementChild as HTMLElement;
    expect(disc().style.getPropertyValue('--identity')).toBe('#ec4899');
    expect(disc().textContent).toBe('PS');
    rerender(<Disc name="Sam Lee" />);
    expect(disc().style.getPropertyValue('--identity')).toBe(
      automaticPresenceColour('Sam Lee').value,
    );
    rerender(<Disc name="Guest" />);
    expect(disc().style.getPropertyValue('--identity')).toBe('');
    rerender(<Disc name={undefined} />);
    expect(disc().textContent).toBe('?');
    expect(disc().className).toContain('bg-slate-200');
  });
});
