// @vitest-environment jsdom
// docs/specs/026-plan/describe-a-plan.md "The preview": a chip with a problem is ringed rose, and keeps that rose ring
// while it is typed in (its focus ring rose, light and dark), where a chip without one takes the brand's.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NameChips } from './NameChips';

afterEach(cleanup);

function show(names: string[], problemAt: (i: number) => string | undefined) {
  render(
    <NameChips
      names={names}
      noun="Column"
      max={8}
      maxLength={40}
      problemAt={problemAt}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
}
const chip = (n: number) => screen.getByRole('textbox', { name: `Column ${n}` }).parentElement!;
const classes = (n: number) => chip(n).className.split(/\s+/);

describe('NameChips', () => {
  it('rings both duplicate chips rose, focus ring included, light and dark', () => {
    const dup = 'Two columns are called “Screen”.';
    show(['Screen', 'Screen', 'Offer'], (i) => (i < 2 ? dup : undefined));
    for (const n of [1, 2]) {
      expect(classes(n)).toEqual(
        expect.arrayContaining([
          'border-rose-400',
          'focus-within:ring-2',
          'focus-within:border-rose-500',
          'focus-within:ring-rose-400/30',
          'dark:focus-within:border-rose-400',
          'dark:focus-within:ring-rose-400/35',
        ]),
      );
      // The brand focus ring would paint over the rose one while the chip is typed in.
      expect(classes(n).filter((c) => c.includes('brand'))).toEqual([]);
    }
    expect(screen.getAllByText(dup)).toHaveLength(1);
  });

  it('gives a chip without a problem the brand focus ring', () => {
    show(['Screen', 'Offer'], () => undefined);
    expect(classes(1)).toEqual(
      expect.arrayContaining([
        'border-slate-200',
        'focus-within:border-brand-400',
        'focus-within:ring-brand-400/25',
      ]),
    );
    expect(classes(1).filter((c) => c.includes('rose'))).toEqual([]);
  });
});
