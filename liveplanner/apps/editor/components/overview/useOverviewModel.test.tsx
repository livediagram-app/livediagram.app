// @vitest-environment jsdom

// docs/specs/026-plan/plan-overview.md "Performance": derived once per change of what it reads; presence moving
// between tabs derives nothing again, someone arriving does.
import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/lib/identity';
import { TabTilePicture } from './TabTilePicture';
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

describe('TabTilePicture', () => {
  it('draws every kind of picture, and pulses one still loading', () => {
    const { container } = render(
      <>
        <TabTilePicture picture={{ kind: 'bars', bars: [] }} />
        <TabTilePicture
          picture={{ kind: 'bars', bars: [{ id: 'x', colour: '#f00', x: 0.5, w: 0.8 }] }}
        />
        <TabTilePicture picture={{ kind: 'sheet' }} />
        <TabTilePicture
          picture={{
            kind: 'dashboard',
            rows: [
              {
                id: 'r',
                slots: [
                  { id: 's', span: 20, filled: true },
                  { id: 't', span: 0, filled: false },
                ],
              },
            ],
          }}
        />
        <TabTilePicture picture={{ kind: 'form', fields: 2 }} />
        <TabTilePicture picture={{ kind: 'empty' }} />
        <TabTilePicture picture={{ kind: 'loading' }} />
        <TabTilePicture picture={{ kind: 'board', columns: [] }} />
      </>,
    );
    const kinds = [...container.querySelectorAll('[data-tile-picture]')].map((el) =>
      el.getAttribute('data-tile-picture'),
    );
    expect(kinds).toEqual([
      'bars',
      'bars',
      'sheet',
      'dashboard',
      'form',
      'empty',
      'loading',
      'board',
    ]);
    // A bar never runs past the tile's edge.
    const bar = container.querySelectorAll('[data-tile-picture="bars"]')[1]!.querySelector('span')!;
    expect(bar.style.width).toBe('50%');
    // Spans stay within the twelve columns.
    const slots = container.querySelectorAll('[data-tile-picture="dashboard"] span');
    expect((slots[0] as HTMLElement).style.gridColumn).toBe('span 12');
    expect((slots[1] as HTMLElement).style.gridColumn).toBe('span 1');
    expect(container.querySelector('[data-tile-picture="loading"]')!.className).toContain(
      'animate-pulse',
    );
    expect(container.querySelectorAll('[data-tile-picture="sheet"] span')).toHaveLength(25);
  });
});
