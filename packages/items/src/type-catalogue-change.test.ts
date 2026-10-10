import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { inverseCatalogueChange, rebaseCatalogueChange } from './type-catalogue-change';
import type { ItemTypeCatalogue } from './type-catalogue';

// docs/specs/026-plan/item-types.md "Storage and sync": a change made again to a catalogue another editor changed
// keeps the other editor's change.

const [project, task, note] = ITEM_TYPES as readonly ItemTypeDef[] as [
  ItemTypeDef,
  ItemTypeDef,
  ItemTypeDef,
];
const cat = (...types: ItemTypeDef[]): ItemTypeCatalogue => ({ version: 1, types });
const ids = (c: ItemTypeCatalogue | null) => c?.types.map((t) => t.id);
const risk: ItemTypeDef = { ...task, id: 'risk', label: 'Risk' };
const spike: ItemTypeDef = { ...task, id: 'spike', label: 'Spike' };

describe('rebaseCatalogueChange', () => {
  it('is the change itself on the catalogue it was made to', () => {
    const change = { before: cat(project, task), after: cat(project, task, risk) };
    expect(rebaseCatalogueChange(cat(project, task), change)).toBe(change.after);
    expect(rebaseCatalogueChange(null, { before: null, after: cat(task) })).toEqual(cat(task));
  });

  it('keeps a type another editor added while adding its own', () => {
    const change = { before: cat(project, task), after: cat(project, task, risk) };
    expect(ids(rebaseCatalogueChange(cat(project, task, spike), change))).toEqual([
      'project',
      'task',
      'risk',
      'spike',
    ]);
  });

  it('changes and deletes only the types it touched', () => {
    const renamed = { ...task, label: 'Job' };
    const change = { before: cat(project, task, note), after: cat(project, renamed) };
    const current = cat(spike, project, task, note);
    expect(rebaseCatalogueChange(current, change)).toEqual(cat(spike, project, renamed));
  });

  it('places an added type first when it leads, last when the type it follows is gone', () => {
    expect(
      ids(rebaseCatalogueChange(cat(task), { before: cat(note), after: cat(risk, note) })),
    ).toEqual(['risk', 'task']);
    expect(
      ids(rebaseCatalogueChange(cat(task), { before: cat(note), after: cat(note, risk) })),
    ).toEqual(['task', 'risk']);
  });

  it('never leaves a catalogue with no type', () => {
    const current = cat(task);
    expect(
      rebaseCatalogueChange(current, { before: cat(project, task), after: cat(project) }),
    ).toBe(current);
  });

  it('undoes one change without undoing a later one', () => {
    const add = { before: cat(project, task), after: cat(project, task, risk) };
    const later = cat(project, task, risk, spike);
    expect(ids(rebaseCatalogueChange(later, inverseCatalogueChange(add)))).toEqual([
      'project',
      'task',
      'spike',
    ]);
  });
});
