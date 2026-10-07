import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { item } from './test-items';
import { linkCandidates, linkFieldsOfType, linkText, linkedCardsOf } from './card-links';
import { laneDropPatch, laneGroups } from './board';
import { readItemTypeCatalogue } from './type-catalogue';

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
      { id: 'f-owner', label: 'Owner', linkType: 'person' },
    ]);
    expect(linkFieldsOfType(ITEM_TYPES[1]!).map((f) => f.id)).toContain('parent');
  });

  it('offers live cards of the linked type, never the card itself', () => {
    const sam = item({ title: 'Sam' }, { type: 'person' });
    const gone = item({ title: 'Gone', archived: true }, { type: 'person' });
    const goal = item({ title: 'Grow' }, { type: 'objective' });
    expect(linkCandidates([sam, gone, goal], 'person').map((i) => i.id)).toEqual([sam.id]);
    expect(linkCandidates([sam], 'person', sam.id)).toEqual([]);
  });

  it('lists the candidates in card number order', () => {
    const late = item({ title: 'Late' }, { type: 'person', key: 9 });
    const early = item({ title: 'Early' }, { type: 'person', key: 2 });
    expect(linkCandidates([late, early], 'person').map((i) => i.key)).toEqual([2, 9]);
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
});
