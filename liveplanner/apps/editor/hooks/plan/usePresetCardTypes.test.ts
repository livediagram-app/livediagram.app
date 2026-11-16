// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import {
  ITEM_TYPES,
  ITEM_TYPE_CATALOGUE_VERSION,
  defaultCatalogue,
  presetSetup,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { usePresetCardTypes } from './usePresetCardTypes';

// docs/specs/026-plan/item-types.md "The type catalogue": a board adds the card types it names that the project
// lacks (a Blank board none); only a board that appears while the project is open counts.
const board = (id: string, preset: 'bug-triage' | 'kanban' | 'sprint' | 'blank') => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  planBoard: presetSetup(preset),
});
// A board taking a Plan template's own types (docs/specs/026-plan/plan-templates.md "Card types a template makes").
const ownBoard = (id: string, addTypes: string[]) => ({
  ...board(id, 'blank'),
  planBoard: { ...presetSetup('blank'), addTypes },
});
const tab = (elements: unknown[]) => ({ id: 't1', name: 'Board', elements }) as unknown as Tab;
const els = (...b: unknown[]) => b as unknown as Tab['elements'];
const ids = (c: ItemTypeCatalogue | undefined) => c?.types.map((t) => t.id);

type Props = Parameters<typeof usePresetCardTypes>[0];
function setup(over: Partial<Props> = {}) {
  const saveCatalogue = vi.fn<Props['saveCatalogue']>();
  const base: Props = {
    tabs: [tab([])],
    activeId: 't1',
    enabled: true,
    canBring: true,
    itemsReady: true,
    catalogue: null,
    saveCatalogue,
    ...over,
  };
  const hook = renderHook((p: Props) => usePresetCardTypes(p), { initialProps: base });
  return { ...hook, base, saveCatalogue };
}

describe('usePresetCardTypes', () => {
  it('lets a fresh project’s first board choose its card types, never the boards it opened with', () => {
    const { rerender, base, saveCatalogue } = setup({ tabs: [tab([board('a', 'bug-triage')])] });
    expect(saveCatalogue).not.toHaveBeenCalled();
    rerender({ ...base, tabs: [tab([board('a', 'bug-triage'), board('b', 'kanban')])] });
    expect(saveCatalogue).toHaveBeenCalledTimes(1);
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual(['task', 'action']);
  });

  it('brings nothing for a Blank board: a later board brings only its own', () => {
    const { rerender, base, saveCatalogue } = setup();
    rerender({ ...base, tabs: [tab([board('a', 'blank')])] });
    expect(saveCatalogue).not.toHaveBeenCalled();
    rerender({ ...base, tabs: [tab([board('a', 'blank'), board('b', 'bug-triage')])] });
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual(['bug']);
  });

  it('adds only what is missing to the card types a project has, and nothing for a Blank board', () => {
    const { rerender, base, saveCatalogue } = setup({ catalogue: defaultCatalogue() });
    rerender({ ...base, tabs: [tab([board('a', 'blank')])] });
    expect(saveCatalogue).not.toHaveBeenCalled();
    rerender({ ...base, tabs: [tab([board('a', 'blank'), board('b', 'bug-triage')])] });
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug']);
  });

  it('brings a template’s boards, every tab’s, in one change, only when it may', () => {
    const { result, rerender, base, saveCatalogue } = setup({ enabled: false });
    result.current.bring(els(board('a', 'sprint'), { id: 's', type: 'sticky' }));
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual(['story', 'task', 'bug']);
    rerender({ ...base, enabled: false, canBring: false });
    result.current.bring(els(board('b', 'bug-triage')));
    expect(saveCatalogue).toHaveBeenCalledTimes(1);
  });

  it('holds a template picked before the cards are known, then decides', () => {
    const { result, rerender, base, saveCatalogue } = setup({ enabled: false, itemsReady: false });
    result.current.bring(els(board('a', 'kanban')));
    result.current.bring(els(board('b', 'bug-triage')));
    expect(saveCatalogue).not.toHaveBeenCalled();
    rerender({ ...base, enabled: false, itemsReady: true });
    expect(saveCatalogue).toHaveBeenCalledTimes(1);
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual(['task', 'action', 'bug']);
  });

  it('loads the templates’ own types only for a board naming one the plan lacks, then brings it', async () => {
    const { templateCardTypesProvided } = await import('@liveplanner/items');
    expect(templateCardTypesProvided()).toBe(false);
    // A plan that already has the type never loads them.
    const has: ItemTypeCatalogue = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [{ ...ITEM_TYPES[1]!, id: 'bt-bug', label: 'Bug' }] };
    const quiet = setup({ catalogue: has, enabled: false });
    quiet.result.current.bring(els(ownBoard('a', ['bt-bug'])));
    expect(quiet.saveCatalogue).not.toHaveBeenCalled();
    expect(templateCardTypesProvided()).toBe(false);
    // One that lacks it loads them, then brings the type.
    const { result, saveCatalogue } = setup({ enabled: false });
    result.current.bring(els(ownBoard('b', ['bt-bug'])));
    expect(saveCatalogue).not.toHaveBeenCalled();
    await waitFor(() => expect(ids(saveCatalogue.mock.lastCall?.[0])).toEqual(['bt-bug']));
    expect(templateCardTypesProvided()).toBe(true);
  });

  it('builds a second bring in the same tick on the first, so neither saves over the other', () => {
    const { result, saveCatalogue } = setup({ enabled: false });
    result.current.bring(els(board('a', 'bug-triage')));
    result.current.bring(els(board('b', 'kanban')));
    expect(saveCatalogue).toHaveBeenCalledTimes(2);
    expect(ids(saveCatalogue.mock.lastCall![0])).toEqual(['bug', 'task', 'action']);
  });
});
