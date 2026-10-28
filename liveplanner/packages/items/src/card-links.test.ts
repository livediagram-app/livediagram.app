import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { item } from './test-items';
import {
  linkCandidates,
  linkFieldsOfType,
  linkText,
  linkableCards,
  linkedCardsOf,
} from './card-links';
import { TRASH_STATUS } from './board';
import { laneDropPatch, laneGroups } from './board';
import { readItemTypeCatalogue } from './type-catalogue';
import { linkTypesOf, withLinkTypes } from './item-types';

// docs/specs/026-plan/item-types.md "Card fields": an Objective's Owner links to one Person.
const person: ItemTypeDef = {
  id: 'person',
  label: 'Person',
  newTitle: 'New person',
  glyph: 'person',
  color: '#2563eb',
  fields: ['title', 'status'],
};
const objective: ItemTypeDef = {
  id: 'objective',
  label: 'Objective',
  newTitle: 'New objective',
  glyph: 'flag',
  color: '#16a34a',
  fields: ['title', 'status', 'f-owner'],
  custom: [{ id: 'f-owner', label: 'Owner', kind: 'card', linkType: 'person' }],
};
const types = [...ITEM_TYPES, person, objective];

describe('card links', () => {
  it('reads a Card field with the type it links to, and refuses one without', () => {
    const read = readItemTypeCatalogue({ version: 1, types: [person, objective] });
    expect(read?.types[1]?.custom?.[0]).toMatchObject({ kind: 'card', linkType: 'person' });
    const broken = { ...objective, custom: [{ id: 'f-owner', label: 'Owner', kind: 'card' }] };
    expect(readItemTypeCatalogue({ version: 1, types: [broken] })).toBeNull();
    // A link to a type the catalogue lacks is kept: the type may come back.
    const gone = { ...objective, custom: [{ ...objective.custom![0]!, linkType: 'nobody' }] };
    expect(
      readItemTypeCatalogue({ version: 1, types: [gone] })?.types[0]?.custom?.[0],
    ).toMatchObject({
      linkType: 'nobody',
    });
  });

  it('lists a type’s link fields, Parent among them', () => {
    expect(linkFieldsOfType(objective)).toEqual([
      { id: 'f-owner', label: 'Owner', linkTypes: ['person'] },
    ]);
    expect(linkFieldsOfType(ITEM_TYPES[1]).map((f) => f.id)).toContain('parent');
  });

  it('offers live cards of the linked type, never the card itself', () => {
    const sam = item({ title: 'Sam' }, { type: 'person' });
    const gone = item({ title: 'Gone', archived: true }, { type: 'person' });
    const goal = item({ title: 'Grow' }, { type: 'objective' });
    expect(linkCandidates([sam, gone, goal], ['person']).map((i) => i.id)).toEqual([sam.id]);
    expect(linkCandidates([sam], ['person'], sam.id)).toEqual([]);
  });

  it('lists the candidates in card number order', () => {
    const late = item({ title: 'Late' }, { type: 'person', key: 9 });
    const early = item({ title: 'Early' }, { type: 'person', key: 2 });
    expect(linkCandidates([late, early], ['person']).map((i) => i.key)).toEqual([2, 9]);
  });

  // docs/specs/026-plan/item-types.md "Link Existing".
  it('offers Link Existing the live cards of the field’s types not linked here yet', () => {
    const sam = item({ title: 'Sam' }, { type: 'person' });
    const lee = item({ title: 'Lee' }, { type: 'person' });
    const mine = item({ title: 'Grow', 'f-owner': sam.id }, { type: 'objective' });
    const theirs = item({ title: 'Hire', 'f-owner': lee.id }, { type: 'objective' });
    const orphan = item({ title: 'Ship', 'f-owner': 'gone-card' }, { type: 'objective' });
    const free = item({ title: 'Plan' }, { type: 'objective' });
    const archived = item({ title: 'Old', archived: true }, { type: 'objective' });
    const trashed = item({ title: 'Bin', status: TRASH_STATUS }, { type: 'objective' });
    const task = item({ title: 'Not linkable' }, { type: 'task' });
    const all = [sam, lee, mine, theirs, orphan, free, archived, trashed, task];
    const group = { fieldId: 'f-owner', fromTypes: ['objective'] };
    expect(linkableCards(sam, group, all).map((l) => [l.card.fields.title, l.elsewhere])).toEqual([
      ['Hire', lee.id],
      ['Ship', 'gone-card'],
      ['Plan', null],
    ]);
  });

  it('lists every type of a field on several types, and never the card itself', () => {
    const epic = item({ title: 'Epic' }, { type: 'epic' });
    const story = item({ title: 'Story' }, { type: 'story' });
    const bug = item({ title: 'Bug' }, { type: 'bug' });
    const group = { fieldId: 'parent', fromTypes: ['story', 'bug', 'epic'] };
    expect(linkableCards(epic, group, [epic, story, bug]).map((l) => l.card.id)).toEqual([
      story.id,
      bug.id,
    ]);
  });

  it('groups the cards pointing at a card by the field they point through', () => {
    const sam = item({ title: 'Sam' }, { type: 'person' });
    const a = item({ title: 'Grow', 'f-owner': sam.id }, { type: 'objective' });
    const b = item({ title: 'Hire', 'f-owner': sam.id }, { type: 'objective' });
    const other = item({ title: 'Ship', 'f-owner': 'someone-else' }, { type: 'objective' });
    const items = new Map([sam, a, b, other].map((i) => [i.id, i]));
    const groups = linkedCardsOf(sam, items, types);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      fieldId: 'f-owner',
      label: 'Owner',
      fromTypes: ['objective'],
    });
    expect(groups[0]!.cards.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it('keeps Parent as a group of a Project, and a type nothing links to has none', () => {
    const proj = item({ title: 'Launch' }, { type: 'project' });
    const kid = item({ title: 'Copy', parent: proj.id });
    const trashed = item({ title: 'Old', parent: proj.id, status: 'trash' });
    const items = new Map([proj, kid, trashed].map((i) => [i.id, i]));
    const groups = linkedCardsOf(proj, items, types);
    expect(groups[0]).toMatchObject({ fieldId: 'parent', label: 'Parent' });
    expect(groups[0]!.cards.map((c) => c.id)).toEqual([kid.id]);
    expect(linkedCardsOf(kid, items, types)).toEqual([]);
  });

  it('names a linked card, or says it is missing', () => {
    const sam = item({ title: 'Sam' }, { type: 'person' });
    const items = new Map([[sam.id, sam]]);
    expect(linkText(items, sam.id)).toBe('Sam');
    expect(linkText(items, 'gone')).toBe('Missing card');
    expect(linkText(items, undefined)).toBeNull();
  });

  it('lanes a board by a Card field, a row per linked card, and a drop sets the link', () => {
    const sam = item({ title: 'Sam' }, { type: 'person', key: 2 });
    const ali = item({ title: 'Ali' }, { type: 'person', key: 1 });
    const a = item({ title: 'Grow', 'f-owner': sam.id }, { type: 'objective' });
    const b = item({ title: 'Hire', 'f-owner': ali.id }, { type: 'objective' });
    const c = item({ title: 'Ship' }, { type: 'objective' });
    const items = new Map([sam, ali, a, b, c].map((i) => [i.id, i]));
    const g = laneGroups('field', 'f-owner', [a, b, c], items, types);
    expect(g.lanes.map((l) => l.label)).toEqual(['Ali', 'Sam', 'No Owner']);
    const samLane = g.lanes.find((l) => l.label === 'Sam');
    expect(laneDropPatch(samLane)).toEqual({ set: { 'f-owner': sam.id } });
  });

  it('reads a trashed or archived linked card as Missing card, until it is back', () => {
    const sam = item({ title: 'Sam Reed', status: 'trash' }, { type: 'person' });
    const ada = item({ title: 'Ada', archived: true }, { type: 'person' });
    const items = new Map([sam, ada].map((c) => [c.id, c]));
    expect(linkText(items, sam.id)).toBe('Missing card');
    expect(linkText(items, ada.id)).toBe('Missing card');
    const back = { ...sam, fields: { title: 'Sam Reed', status: 'todo' } };
    expect(linkText(new Map([[back.id, back]]), back.id)).toBe('Sam Reed');
  });

  // docs/specs/026-plan/item-types.md "Card fields": one field, several card types.
  describe('a Card field of several types', () => {
    const team: ItemTypeDef = { ...person, id: 'team', label: 'Team', newTitle: 'New team' };
    const multi: ItemTypeDef = {
      ...objective,
      custom: [
        {
          id: 'f-owner',
          label: 'Owner',
          kind: 'card',
          linkType: 'person',
          linkTypes: ['person', 'team'],
        },
      ],
    };
    const all = [...ITEM_TYPES, person, team, multi];

    it('reads its types, and an older field as its one linkType', () => {
      expect(linkTypesOf(multi.custom![0]!)).toEqual(['person', 'team']);
      expect(linkTypesOf({ linkType: 'person' })).toEqual(['person']);
      expect(linkTypesOf({})).toEqual([]);
      // An older editor re-pointed linkType alone: linkType wins.
      expect(linkTypesOf({ linkType: 'project', linkTypes: ['person', 'team'] })).toEqual([
        'project',
      ]);
    });

    it('stores linkType as the first and linkTypes only when there are several', () => {
      const base = { id: 'f-x', label: 'X', kind: 'card' as const };
      expect(withLinkTypes(base, ['team', 'person', 'team'])).toEqual({
        ...base,
        linkType: 'team',
        linkTypes: ['team', 'person'],
      });
      expect(withLinkTypes({ ...base, linkTypes: ['a', 'b'] }, ['person'])).toEqual({
        ...base,
        linkType: 'person',
      });
      expect(withLinkTypes({ ...base, linkType: 'person' }, [])).toEqual(base);
    });

    it('reads and normalises a stored field of several types, refusing a bad list', () => {
      const read = readItemTypeCatalogue({ version: 1, types: [person, team, multi] });
      expect(read?.types[2]?.custom?.[0]).toMatchObject({
        linkType: 'person',
        linkTypes: ['person', 'team'],
      });
      const one = {
        ...multi,
        custom: [{ ...multi.custom![0]!, linkTypes: ['person', 'person'] }],
      };
      const readOne = readItemTypeCatalogue({ version: 1, types: [person, one] });
      expect(readOne?.types[1]?.custom?.[0]).toEqual({
        id: 'f-owner',
        label: 'Owner',
        kind: 'card',
        linkType: 'person',
      });
      for (const bad of [
        [],
        'person',
        ['Not A Type'],
        Array.from({ length: 33 }, (_, i) => `t${i}`),
      ]) {
        const broken = { ...multi, custom: [{ ...multi.custom![0]!, linkTypes: bad }] };
        expect(readItemTypeCatalogue({ version: 1, types: [person, broken] })).toBeNull();
      }
    });

    it('offers cards of every type it links to, and lists both types', () => {
      const sam = item({ title: 'Sam' }, { type: 'person', key: 3 });
      const ops = item({ title: 'Ops' }, { type: 'team', key: 1 });
      const goal = item({ title: 'Grow' }, { type: 'objective', key: 2 });
      expect(linkCandidates([sam, ops, goal], ['person', 'team']).map((i) => i.key)).toEqual([
        1, 3,
      ]);
      expect(linkFieldsOfType(multi)).toEqual([
        { id: 'f-owner', label: 'Owner', linkTypes: ['person', 'team'] },
      ]);
    });

    it('groups the cards pointing at a card of either type', () => {
      const ops = item({ title: 'Ops' }, { type: 'team' });
      const sam = item({ title: 'Sam' }, { type: 'person' });
      const a = item({ title: 'Grow', 'f-owner': ops.id }, { type: 'objective' });
      const b = item({ title: 'Hire', 'f-owner': sam.id }, { type: 'objective' });
      const items = new Map([ops, sam, a, b].map((i) => [i.id, i]));
      expect(linkedCardsOf(ops, items, all)[0]!.cards.map((c) => c.id)).toEqual([a.id]);
      expect(linkedCardsOf(sam, items, all)[0]!.cards.map((c) => c.id)).toEqual([b.id]);
    });

    it('lanes a board by it, one row per linked card of either type', () => {
      const ops = item({ title: 'Ops' }, { type: 'team', key: 1 });
      const sam = item({ title: 'Sam' }, { type: 'person', key: 2 });
      const a = item({ title: 'Grow', 'f-owner': ops.id }, { type: 'objective' });
      const b = item({ title: 'Hire', 'f-owner': sam.id }, { type: 'objective' });
      const items = new Map([ops, sam, a, b].map((i) => [i.id, i]));
      const g = laneGroups('field', 'f-owner', [a, b], items, all);
      expect(g.lanes.map((l) => l.label)).toEqual(['Ops', 'Sam']);
    });
  });
});
