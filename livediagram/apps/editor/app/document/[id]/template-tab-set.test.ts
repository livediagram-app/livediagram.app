import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { buildTemplate } from '@livediagram/templates';
import { landTemplateOnTab } from './template-tab-set';

const tab = (id: string, extra: Partial<Tab> = {}): Tab => ({
  id,
  name: id,
  elements: [],
  ...extra,
});

// docs/specs/007-editor/new-document-route.md: Quick Start never replaces work. The builders load
// after the empty check, so a collaborator's element can land on the tab in between.
describe('landTemplateOnTab', () => {
  const build = (target: Tab): Tab => ({
    ...target,
    elements: [{ id: 'scaffold' }] as Tab['elements'],
    templateChosen: true,
  });

  it('lands the template on a still-empty tab', () => {
    const out = landTemplateOnTab([tab('a'), tab('b')], 'a', build);
    expect(out.map((t) => t.id)).toEqual(['a', 'b']);
    expect(out[0]!.elements.map((e) => e.id)).toEqual(['scaffold']);
  });

  it('leaves the tabs unchanged when the tab gained an element meanwhile', () => {
    const theirs = tab('a', { elements: [{ id: 'theirs' }] as Tab['elements'] });
    const out = landTemplateOnTab([theirs, tab('b')], 'a', build);
    expect(out).toEqual([theirs, tab('b')]);
  });

  it('leaves the tabs unchanged when the tab is gone', () => {
    expect(landTemplateOnTab([tab('b')], 'a', build)).toEqual([tab('b')]);
  });

  // docs/specs/008-canvas/canvas-and-palette.md "Templates": the C4 levels link to each other when one lands.
  it('links a landed C4 level to the level beside it', () => {
    const containers = tab('con', { elements: buildTemplate('c4-container', 0, 0) });
    const out = landTemplateOnTab([containers, tab('cmp')], 'cmp', (t) => ({
      ...t,
      elements: buildTemplate('c4-component', 0, 0),
    }));
    const boundary = out[1]!.elements.find((e) => e.type === 'shape' && e.shape === 'boundary');
    expect(boundary && 'link' in boundary && boundary.link).toEqual({ kind: 'tab', tabId: 'con' });
  });
});
