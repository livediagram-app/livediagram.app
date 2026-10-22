import { describe, expect, it } from 'vitest';
import { buildTemplateTabs, validTemplateKinds, type TemplateKind } from '@liveplanner/templates';
import { elementsIssue } from './element-values';

const view = (extra: Record<string, unknown>) => ({
  id: 'v1',
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 0,
  width: 500,
  height: 360,
  planView: { view: 'gantt' },
  ...extra,
});

describe('elementsIssue', () => {
  it('passes well-formed elements', () => {
    expect(elementsIssue([view({ label: 'Plan', textSize: 'lg' })])).toBeNull();
  });

  it('refuses an element no liveplanner tab holds', () => {
    expect(elementsIssue([view({ shape: 'square' })])).toBe(
      'element "v1": shape "square" is not an element a liveplanner tab holds; read liveplanner://schema/elements.',
    );
    expect(elementsIssue([{ id: 'a', type: 'arrow' }])).toMatch(
      /^element "a": type "arrow" is not/,
    );
    expect(elementsIssue([view({ shape: 'bar-chart', planView: undefined })])).toMatch(
      /a bar-chart reads a Sheet's cells/,
    );
  });

  it('refuses a field the type does not have, naming fields like it', () => {
    expect(elementsIssue([view({ planview: 1 })])).toMatch(
      /^element "v1": "planview" is not a field of a shape; fields like it: .*planView/,
    );
  });

  it('refuses a text size off the scale', () => {
    expect(elementsIssue([view({ textSize: 'xl' })])).toBe(
      'element "v1": textSize "xl" is not one of sm, md, lg, scale.',
    );
  });

  // A template read back with format "json" and sent again must always pass.
  it('passes every element of every template', () => {
    for (const kind of validTemplateKinds().split(', ') as TemplateKind[]) {
      const tabs = buildTemplateTabs({ id: 't', name: 'T' }, kind, () => crypto.randomUUID());
      for (const tab of tabs) expect(elementsIssue(tab.elements), kind).toBeNull();
    }
  });
});
