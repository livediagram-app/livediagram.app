import { describe, expect, it } from 'vitest';
import { buildTemplateTabs, validTemplateKinds, type TemplateKind } from '@livepages/templates';
import { elementsIssue } from './element-values';

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
      const tabs = buildTemplateTabs({ id: 't', name: 'T' }, kind, () => crypto.randomUUID());
      for (const tab of tabs) expect(elementsIssue(tab.elements), kind).toBeNull();
    }
  });
});
