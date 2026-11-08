// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { sameEntries, usePlanItemsSelect } from './plan-items-store';

// docs/specs/026-plan/blueprints/plan-board.md "Card redraws": a card redraws when what it picks of other cards
// changes, never for a change to a card it does not read.
afterEach(cleanup);

const card = (id: string, title: string) => ({ id, fields: { title } }) as unknown as Item;
const plan = (items: Item[]) =>
  ({ items: new Map(items.map((i) => [i.id, i])), types: [] }) as unknown as PlanContextValue;

const Reader = memo(function Reader({ id, draws }: { id: string; draws: string[] }) {
  const linked = usePlanItemsSelect((all) => [all.get(id)], sameEntries, [id]);
  const title = (linked[0]?.fields['title'] as string | undefined) ?? 'missing';
  draws.push(title);
  return <span data-testid={id}>{title}</span>;
});

describe('usePlanItemsSelect', () => {
  it('redraws a reader only when the card it reads changes', () => {
    const draws: string[] = [];
    const a = card('a', 'A');
    const b = card('b', 'B');
    const tree = (v: PlanContextValue) => (
      <PlanProvider value={v}>
        <Reader id="a" draws={draws} />
      </PlanProvider>
    );
    const r = render(tree(plan([a, b])));
    expect(draws).toEqual(['A']);
    r.rerender(tree(plan([a, card('b', 'B2')])));
    expect(draws).toEqual(['A']);
    r.rerender(tree(plan([card('a', 'A2'), b])));
    expect(r.getByTestId('a').textContent).toBe('A2');
    expect(draws.at(-1)).toBe('A2');
    r.rerender(tree(plan([b])));
    expect(r.getByTestId('a').textContent).toBe('missing');
  });

  it('reads the plan itself outside a provider', async () => {
    vi.resetModules();
    vi.doMock('./PlanContext', () => ({ usePlan: () => plan([card('a', 'Mocked')]) }));
    const store = await import('./plan-items-store');
    function Bare() {
      const linked = store.usePlanItemsSelect((all) => [all.get('a')], store.sameEntries, []);
      return <span data-testid="bare">{linked[0]?.fields['title'] as string}</span>;
    }
    const r = render(<Bare />);
    expect(r.getByTestId('bare').textContent).toBe('Mocked');
    vi.doUnmock('./PlanContext');
  });
});
