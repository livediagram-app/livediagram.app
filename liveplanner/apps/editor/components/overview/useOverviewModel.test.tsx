// @vitest-environment jsdom

// docs/specs/026-plan/plan-overview.md "Performance": derived once per change of what it reads; presence moving
// between tabs derives nothing again, someone arriving does.
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/lib/identity';
import { TYPES, boardTab, card, itemsOf } from './overview-fixtures.test-helpers';

const { derive } = vi.hoisted(() => ({ derive: vi.fn() }));
vi.mock('./overview-model', async (importOriginal) => {
  const real = await importOriginal<typeof import('./overview-model')>();
  return {
    ...real,
    overviewModelOf: (input: Parameters<typeof real.overviewModelOf>[0]) => {
      derive(input);
      return real.overviewModelOf(input);
    },
  };
});

const { useOverviewModel } = await import('./useOverviewModel');

afterEach(() => {
  cleanup();
  derive.mockClear();
});

const tabs = [boardTab('a', 'Triage')];
const items = itemsOf([card('1')]);
const loaded = new Set(['a']);
const statusNames = new Map<string, string>();
const tess = { id: 'tess', name: 'Tess', color: '#6d4aa8' } as Participant;

type HookProps = { byTab: Map<string, Participant[]>; owner: string | null };
const START: HookProps = { byTab: new Map([['a', [tess]]]), owner: 'owner' };

function hook() {
  return renderHook(
    ({ byTab, owner }: HookProps) =>
      useOverviewModel({
        tabs,
        items,
        types: TYPES,
        statusNames,
        loadedTabIds: loaded,
        owner: owner ? { id: owner, name: 'Ana', color: '#000' } : null,
        participantsByTab: byTab,
        createdAt: 1,
      }),
    { initialProps: START },
  );
}

describe('useOverviewModel', () => {
  it('derives once, and not again for a presence move between tabs', () => {
    const { result, rerender } = hook();
    expect(derive).toHaveBeenCalledTimes(1);
    const first = result.current;
    rerender({ byTab: new Map([['b', [tess]]]), owner: 'owner' });
    expect(derive).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(first);
    expect(first.people.map((p) => p.name)).toEqual(['Ana', 'Tess', 'Ana Moreno']);
  });

  it('derives again when someone arrives, and reads no owner as none', () => {
    const { rerender, result } = hook();
    rerender({
      byTab: new Map([['a', [tess, { id: 'kai', name: 'Kai', color: '#111' } as Participant]]]),
      owner: null,
    });
    expect(derive).toHaveBeenCalledTimes(2);
    expect(result.current.people.map((p) => p.name)).toEqual(['Kai', 'Tess', 'Ana Moreno']);
  });
});
