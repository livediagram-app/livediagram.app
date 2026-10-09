import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { PLAN_BOARD_PRESET_IDS, presetSetup, type PlanBoardPresetId } from './presets';
import {
  READY_MADE_CARD_TYPES,
  boardTypeIdsOf,
  boardTypesToAdd,
  broughtTypesToAdd,
  catalogueWithBoardTypes,
  defaultTypesToAdd,
} from './brought-types';
import { typeCardDisplay } from './card-display';
import {
  ITEM_TYPES_MAX,
  READY_MADE_DEFAULT_STATE_NAMES,
  validateItemTypeCatalogue,
} from './type-catalogue';

const board = (addTypes?: string[]) => ({
  type: 'shape',
  shape: 'plan-board',
  planBoard: { ...presetSetup('blank'), ...(addTypes ? { addTypes } : {}) },
});
const preset = (id: PlanBoardPresetId) => ({
  type: 'shape',
  shape: 'plan-board',
  planBoard: presetSetup(id),
});
const ids = (types: readonly { id: string }[] | undefined) => types?.map((t) => t.id);
const DEFAULT_IDS = ITEM_TYPES.map((t) => t.id);

// docs/specs/026-plan/plan-templates.md "Ready-made card types", item-types.md "The type catalogue".
describe('ready-made card types', () => {
  it('are the five default types first, then the rest, all valid together, each id once', () => {
    expect(READY_MADE_CARD_TYPES.slice(0, 5)).toEqual(ITEM_TYPES);
    const checked = validateItemTypeCatalogue({ version: 1, types: READY_MADE_CARD_TYPES });
    expect(checked.ok).toBe(true);
    const all = ids(READY_MADE_CARD_TYPES)!;
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeLessThanOrEqual(ITEM_TYPES_MAX);
  });

  it('offer comments, last, and link only to types that exist', () => {
    const known = new Set(ids(READY_MADE_CARD_TYPES));
    for (const t of READY_MADE_CARD_TYPES) {
      expect(t.fields.at(-1)).toBe('comments');
      for (const c of t.custom ?? []) {
        expect(t.fields).toContain(c.id);
        if (c.kind === 'card') expect(known.has(c.linkType!)).toBe(true);
      }
    }
  });

  it('give every ready-made type a Default State by name', () => {
    for (const t of READY_MADE_CARD_TYPES)
      expect(READY_MADE_DEFAULT_STATE_NAMES[t.id], t.id).toBeTruthy();
  });

  it('date the types a Gantt chart draws', () => {
    for (const id of ['role', 'objective']) {
      const t = READY_MADE_CARD_TYPES.find((b) => b.id === id)!;
      expect(t.fields).toEqual(expect.arrayContaining(['start', 'due']));
    }
  });

  it('put the fields a board is read by on the card', () => {
    const kr = READY_MADE_CARD_TYPES.find((t) => t.id === 'key-result')!;
    expect(typeCardDisplay(kr, 'detailed')).toEqual(
      expect.arrayContaining(['f-current', 'f-target', 'due', 'assignee']),
    );
  });

  it('name only ready-made types on every preset', () => {
    const known = new Set(ids(READY_MADE_CARD_TYPES));
    for (const id of PLAN_BOARD_PRESET_IDS)
      for (const t of presetSetup(id).addTypes ?? []) expect(known.has(t)).toBe(true);
  });

  it('keep each preset to the card types its work is made of', () => {
    expect(presetSetup('kanban').addTypes).toEqual(['task', 'action']);
    expect(presetSetup('sprint').addTypes).toEqual(['story', 'task', 'bug']);
    expect(presetSetup('bug-triage').addTypes).toEqual(['bug']);
    expect(presetSetup('retro').addTypes).toEqual(['note', 'idea']);
    expect(presetSetup('blank').addTypes).toBeUndefined();
  });
});

describe('what boards bring', () => {
  it('names a board’s own types, the defaults for a Blank board, nothing for Archive or All Cards', () => {
    const els = [
      { type: 'sticky' },
      board(['candidate']),
      { type: 'shape', shape: 'rect', planBoard: { addTypes: ['role'] } },
      preset('archive'),
      preset('all-cards'),
      board(),
    ];
    expect(boardTypeIdsOf(els)).toEqual(['candidate', ...DEFAULT_IDS]);
  });

  it('adds only those the document lacks, once each, in the boards’ order', () => {
    expect(ids(broughtTypesToAdd(['bug', 'task'], ITEM_TYPES))).toEqual(['bug']);
    const withBug: ItemTypeDef[] = [
      ...ITEM_TYPES,
      { ...READY_MADE_CARD_TYPES[5]!, label: 'Defect' },
    ];
    expect(broughtTypesToAdd(['bug'], withBug)).toEqual([]);
    expect(broughtTypesToAdd(undefined, ITEM_TYPES)).toEqual([]);
    expect(ids(broughtTypesToAdd(['role', 'candidate', 'role', 'nope'], []))).toEqual([
      'role',
      'candidate',
    ]);
    expect(ids(boardTypesToAdd([board(['role']), board(['task'])], ITEM_TYPES))).toEqual(['role']);
  });

  it('adds the default types a document lacks, in their order', () => {
    const some = ITEM_TYPES.filter((t) => t.id !== 'note' && t.id !== 'project');
    expect(ids(defaultTypesToAdd(some))).toEqual(['project', 'note']);
    expect(defaultTypesToAdd(ITEM_TYPES)).toEqual([]);
  });
});

describe('the catalogue boards leave', () => {
  it('lets the first boards of a fresh document choose its card types, exactly', () => {
    expect(ids(catalogueWithBoardTypes(null, [preset('kanban')])?.types)).toEqual([
      'task',
      'action',
    ]);
    expect(
      ids(catalogueWithBoardTypes(null, [board(['role']), board(['candidate', 'role'])])?.types),
    ).toEqual(['role', 'candidate']);
  });

  it('leaves a fresh document reading as the defaults for a Blank board, or no board', () => {
    expect(catalogueWithBoardTypes(null, [board()])).toBeNull();
    expect(catalogueWithBoardTypes(null, [preset('archive')])).toBeNull();
    expect(catalogueWithBoardTypes(null, [])).toBeNull();
  });

  it('adds what is missing to a document with cards, after the default types', () => {
    expect(ids(catalogueWithBoardTypes(null, [preset('bug-triage')], true)?.types)).toEqual([
      ...DEFAULT_IDS,
      'bug',
    ]);
    expect(catalogueWithBoardTypes(null, [preset('kanban')], true)).toBeNull();
  });

  it('adds what is missing once the card types are chosen, a Blank board the default types', () => {
    const hiring = { version: 1, types: READY_MADE_CARD_TYPES.filter((t) => t.id === 'role') };
    expect(ids(catalogueWithBoardTypes(hiring, [preset('sprint')])?.types)).toEqual([
      'role',
      'story',
      'task',
      'bug',
    ]);
    expect(ids(catalogueWithBoardTypes(hiring, [board()])?.types)).toEqual([
      'role',
      ...DEFAULT_IDS,
    ]);
    expect(catalogueWithBoardTypes(hiring, [board(['role'])])).toBeNull();
  });

  it('never grows a catalogue past its cap', () => {
    const full = {
      version: 1,
      types: Array.from({ length: ITEM_TYPES_MAX }, (_, i) => ({ ...ITEM_TYPES[1]!, id: `t${i}` })),
    };
    expect(catalogueWithBoardTypes(full, [board(['bug'])])).toBeNull();
    const nearly = { version: 1, types: full.types.slice(1) };
    expect(catalogueWithBoardTypes(nearly, [board(['bug', 'story'])])?.types).toHaveLength(
      ITEM_TYPES_MAX,
    );
  });
});
