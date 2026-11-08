// @vitest-environment jsdom

// A board's Card Types and Board Setup missions (docs/specs/026-plan/plan-tour.md "Boards: Card Types", "Boards: Board
// Setup"): each is done by a change to the real plan, checked against how it was when the track started.

import type { Item, ItemTypeDef, PlanBoardSetup, PlanColumn } from '@liveplanner/items';
import { DEFAULT_BOARD_WIDGETS } from '@liveplanner/items';
import { describe, expect, it } from 'vitest';
import {
  newTypeOf,
  setupChanged,
  setupMissions,
  typeShape,
  typesMissions,
  type SetupCtx,
  type TypesCtx,
} from './board-tracks';
import { boardRoot } from './plan-tour-steps';

const type = (id: string, over: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  id,
  label: id,
  newTitle: `New ${id}`,
  glyph: 'item',
  color: '#000',
  fields: ['title'],
  ...over,
});
const card = (id: string, typeId: string): Item =>
  ({ id, type: typeId, key: 0, rank: 'a', fields: {} }) as unknown as Item;

const START = new Set(['task']);
const typesCtx = (over: Partial<TypesCtx> = {}): TypesCtx => ({
  startIds: START,
  types: [type('task')],
  firstShape: null,
  practice: [],
  ...over,
});

describe('typesMissions', () => {
  const [make, edit, use] = typesMissions('b0', 'To Do');

  it('runs make, edit and use in order, naming the first column', () => {
    expect(typesMissions('b0', 'To Do').map((m) => m.id)).toEqual([
      'make-type',
      'edit-type',
      'use-type',
    ]);
    expect(use!.why).toContain('To Do');
    expect(use!.hints[0]!.text).toContain('To Do');
  });

  it('makes a type once one the plan did not have exists', () => {
    expect(make!.done(typesCtx())).toBe(false);
    expect(make!.done(typesCtx({ types: [type('task'), type('risk')] }))).toBe(true);
    expect(newTypeOf({ startIds: START, types: [type('task'), type('risk')] })?.id).toBe('risk');
    expect(newTypeOf({ startIds: START, types: [type('task')] })).toBeUndefined();
  });

  it('edits it only once its fields differ from how it was first saved', () => {
    const risk = type('risk');
    const first = typeShape(risk);
    expect(edit!.done(typesCtx())).toBe(false);
    // Made, but not seen yet.
    expect(edit!.done(typesCtx({ types: [type('task'), risk] }))).toBe(false);
    expect(edit!.done(typesCtx({ types: [type('task'), risk], firstShape: first }))).toBe(false);
    // A colour is not a field.
    const recoloured = type('risk', { color: '#f00' });
    expect(edit!.done(typesCtx({ types: [type('task'), recoloured], firstShape: first }))).toBe(
      false,
    );
    const withDue = type('risk', { fields: ['title', 'due'] });
    expect(edit!.done(typesCtx({ types: [type('task'), withDue], firstShape: first }))).toBe(true);
    const withCustom = type('risk', {
      custom: [{ id: 'c1', label: 'Impact', kind: 'text' }] as unknown as ItemTypeDef['custom'],
    });
    expect(edit!.done(typesCtx({ types: [type('task'), withCustom], firstShape: first }))).toBe(
      true,
    );
  });

  it('uses it once a practice card of the new type is on the board', () => {
    const types = [type('task'), type('risk')];
    expect(use!.done(typesCtx({ practice: [card('p1', 'risk')] }))).toBe(false);
    expect(use!.done(typesCtx({ types, practice: [card('p1', 'task')] }))).toBe(false);
    expect(use!.done(typesCtx({ types, practice: [card('p1', 'risk')] }))).toBe(true);
  });

  it('rings the Types button, the editor’s fields and the board’s Add card', () => {
    expect(make!.hints[0]!.ring!()).toBe('[data-tour-id="card-types"]');
    expect(make!.hints[1]!.ring!()).toBe('[data-tour-id="card-type-general"] input');
    expect(edit!.hints[0]!.ring!()).toBe('[data-tour-id="card-types"]');
    expect(edit!.hints[1]!.ring!()).toBe('[data-tour-id="card-type-fields"] [data-add-field]');
    expect(use!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} [data-add-card-trigger]`);
  });
});

const col = (id: string, name: string, over: Partial<PlanColumn> = {}): PlanColumn => ({
  id,
  status: id,
  name,
  ...over,
});
const setup = (over: Partial<PlanBoardSetup> = {}): PlanBoardSetup => ({
  title: 'Board',
  columns: [col('todo', 'To Do'), col('doing', 'Doing')],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  ...over,
});

describe('setupMissions', () => {
  const [rename, wip, widget] = setupMissions('b0');
  const ctx = (now: Partial<PlanBoardSetup>, start: Partial<PlanBoardSetup> = {}): SetupCtx => ({
    start: setup(start),
    now: setup(now),
  });

  it('runs rename, WIP and widget in order', () => {
    expect(setupMissions('b0').map((m) => m.id)).toEqual([
      'rename-column',
      'set-wip',
      'add-widget',
    ]);
  });

  it('renames a column once one that was there has a new name', () => {
    expect(rename!.done(ctx({}))).toBe(false);
    expect(rename!.done(ctx({ columns: [col('todo', 'Backlog'), col('doing', 'Doing')] }))).toBe(
      true,
    );
    // A new column with a new id is not a rename.
    expect(
      rename!.done(
        ctx({ columns: [col('todo', 'To Do'), col('doing', 'Doing'), col('new', 'Review')] }),
      ),
    ).toBe(false);
    expect(rename!.done(ctx({ columns: [col('todo', 'To Do'), col('x', 'Doing2')] }))).toBe(false);
  });

  it('sets a WIP limit once a column’s limit changes', () => {
    expect(wip!.done(ctx({}))).toBe(false);
    expect(
      wip!.done(ctx({ columns: [col('todo', 'To Do'), col('doing', 'Doing', { wipLimit: 3 })] })),
    ).toBe(true);
    expect(
      wip!.done(
        ctx(
          { columns: [col('todo', 'To Do'), col('doing', 'Doing', { wipLimit: 3 })] },
          { columns: [col('todo', 'To Do'), col('doing', 'Doing', { wipLimit: 3 })] },
        ),
      ),
    ).toBe(false);
    expect(wip!.done(ctx({ columns: [col('new', 'New', { wipLimit: 2 })] }))).toBe(false);
  });

  it('adds a widget once the header has one it did not, reading no widgets as the defaults', () => {
    expect(widget!.done(ctx({}))).toBe(false);
    // Naming the defaults is no new widget.
    expect(widget!.done(ctx({ widgets: [...DEFAULT_BOARD_WIDGETS] }))).toBe(false);
    expect(widget!.done(ctx({ widgets: [...DEFAULT_BOARD_WIDGETS, 'due'] }))).toBe(true);
    // Removing one is not adding.
    expect(widget!.done(ctx({ widgets: ['count'] }))).toBe(false);
    expect(widget!.done(ctx({ widgets: ['count', 'points'] }, { widgets: ['count'] }))).toBe(true);
    expect(widget!.done(ctx({}, { widgets: ['count'] }))).toBe(true);
  });

  it('rings the column cog, the WIP input and the add widget button', () => {
    expect(rename!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} [aria-label$=" column settings"]`);
    expect(wip!.hints[1]!.ring!()).toBe('[id^="column-"][id$="-wip"]');
    expect(widget!.hints[1]!.ring!()).toBe(`${boardRoot('b0')} button[aria-label="Add a widget"]`);
  });
});

describe('setupChanged', () => {
  it('tells a changed setup from the one it started as', () => {
    expect(setupChanged(setup(), setup())).toBe(false);
    expect(setupChanged(setup(), setup({ title: 'Other' }))).toBe(true);
    expect(setupChanged(setup(), setup({ widgets: ['count'] }))).toBe(true);
  });
});
