import { describe, expect, it } from 'vitest';
import { buildTemplateTab, validTemplateKinds, type TemplateKind } from '@livediagram/templates';
import { elementsIssue, tabElementsIssue } from './element-values';

const box = (extra: Record<string, unknown>) => ({
  id: 'b1',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...extra,
});

describe('elementsIssue', () => {
  it('passes well-formed elements', () => {
    expect(elementsIssue([box({ label: 'A', textSize: 'lg', iconId: 'database' })])).toBeNull();
  });

  it('names the fields sharing a camelCase key\'s first word ("strokeColour" is near strokeColor)', () => {
    expect(elementsIssue([box({ strokeColour: '#000' })])).toMatch(
      /"strokeColour" is not a field of a shape; fields like it: strokeColor, strokeWidth/,
    );
  });

  it('refuses a field the type does not have, naming fields like it', () => {
    expect(elementsIssue([box({ icon: 'database' })])).toMatch(
      /^element "b1": "icon" is not a field of a shape; fields like it: .*iconId/,
    );
  });

  it('refuses a text size off the scale', () => {
    expect(elementsIssue([box({ textSize: 'xl' })])).toBe(
      'element "b1": textSize "xl" is not one of sm, md, lg, scale.',
    );
  });

  it('refuses an icon id that names no icon, pointing at icons like it or the search', () => {
    expect(elementsIssue([box({ iconId: 'database-' })])).toMatch(
      /^element "b1": iconId "database-" is not an icon; icons like it: database/,
    );
    expect(elementsIssue([box({ iconId: 'zzqx' })])).toBe(
      'element "b1": iconId "zzqx" is not an icon; search_icons finds one by what it shows.',
    );
  });

  it('leaves an unknown type to the validator', () => {
    expect(elementsIssue([{ id: 'x', type: 'blob', icon: 1 }])).toBeNull();
  });

  // A template read back with format "json" and sent again must always pass.
  it('passes every element of every template', () => {
    for (const kind of validTemplateKinds().split(', ') as TemplateKind[]) {
      expect(elementsIssue(buildTemplateTab('t', 'T', kind).elements), kind).toBeNull();
    }
  });
});

// create_document names what is wrong with an element, as add_tab and update_document do.
describe('tabElementsIssue', () => {
  it("names the element and the field a rule refuses (a card's seventh tag)", () => {
    const card = box({ id: 'svc', shape: 'card', tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    expect(tabElementsIssue([card])).toMatch(
      /^element "svc": "tags" must be an array of at most 6/,
    );
  });

  // docs/specs/009-elements/badge.md "The cap holds for agents".
  it('names a badge or step whose label is over its cap, and the cap', () => {
    expect(tabElementsIssue([box({ id: 'b', shape: 'badge', label: 'z'.repeat(25) })])).toBe(
      'element "b": a badge\'s label is at most 24 characters.',
    );
    expect(tabElementsIssue([box({ id: 's', shape: 'step', label: '1000' })])).toBe(
      'element "s": a step\'s label is at most 3 characters.',
    );
    expect(tabElementsIssue([box({ id: 's', shape: 'step', label: '100' })])).toBeNull();
  });

  it('names an id given twice', () => {
    expect(tabElementsIssue([box({ id: 'svc' }), box({ id: 'svc' })])).toBe(
      'element "svc": the id is used twice; give each element its own.',
    );
  });

  it('passes valid elements', () => {
    expect(tabElementsIssue([box({ id: 'a' }), box({ id: 'b' })])).toBeNull();
  });
});
