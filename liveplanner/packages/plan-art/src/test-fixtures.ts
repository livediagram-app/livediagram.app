// Fixtures for the Plan image tests (docs/specs/026-plan/plan-tabs.md "Export"): cards, phases and a picture's data.
import { ITEM_TYPES, type Item, type StatusPhase } from '@liveplanner/items';
import type { Element } from '@liveplanner/project';
import type { PlanArtData } from './plan-view-art';

let n = 0;
const ALI = { id: 'ali', name: 'Ali', color: '#123456' };

export function card(fields: Item['fields'], type = 'task'): Item {
  n += 1;
  return {
    id: `i${n}`,
    type,
    key: n,
    rank: `r${n}`,
    fields,
    createdBy: ALI,
    updatedBy: ALI,
    createdAt: 0,
    updatedAt: 0,
  } as Item;
}

export const PHASES = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['done', 'done'],
]);

export const NOW = new Date('2026-10-10T12:00:00Z');

export function artData(items: Item[]): PlanArtData {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: ITEM_TYPES,
    statusPhases: PHASES,
    statusNames: new Map([
      ['todo', 'To Do'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]),
    now: NOW,
    chartPalette: ['#2563eb', '#16a34a', '#f59e0b'],
  };
}

export const shape = (
  id: string,
  shapeKind: string,
  extra: Record<string, unknown> = {},
): Element =>
  ({
    id,
    type: 'shape',
    shape: shapeKind,
    x: 0,
    y: 0,
    width: 720,
    height: 400,
    ...extra,
  }) as Element;
