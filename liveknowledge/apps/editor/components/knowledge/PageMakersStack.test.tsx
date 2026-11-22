// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageMakersStackView, STACK_MAX, makersOf } from './PageMakersStack';

afterEach(cleanup);

const names: Record<string, string> = { u1: 'Priya Shah', u2: 'Sam Lee' };
const nameOf = (id: string | undefined) => (id ? names[id] : undefined);

describe('who made the page, in the top row', () => {
  it('names the creator first, then the editors; an agent by its name, an unknown person as Guest', () => {
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
      'Claude, Edited',
      'Guest, Edited',
    ]);
    render(<PageMakersStackView makers={makers} />);
    expect(screen.getByRole('img', { name: 'Priya Shah, Created' }).textContent).toBe('PS');
    expect(screen.getByRole('img', { name: 'Claude, Edited' })).toBeTruthy();
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
