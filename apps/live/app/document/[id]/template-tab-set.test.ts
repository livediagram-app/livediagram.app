import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { insertTabsAfter, landTemplateOnTab, templateFollowerTabs } from './template-tab-set';

// docs/specs/026-plan/plan-templates.md "How a template with tabs is made": Quick Start lands the first
// template tab on its tab and adds the others straight after it, with its look.
const tab = (id: string, extra: Partial<Tab> = {}): Tab => ({
  id,
  name: id,
  elements: [],
  ...extra,
});

describe('templateFollowerTabs', () => {
  it('gives each later tab the landed tab’s look, its own id, name and elements, and the overrides', () => {
    const landed = tab('a', {
      theme: 'ocean',
      backgroundColor: '#000',
      backgroundPattern: 'lines',
      defaultTextSize: 'md',
      opensIn: 'plan',
      locked: true,
    });
    const [follower] = templateFollowerTabs(landed, [{ id: 'b', name: 'Backlog', elements: [] }], {
      backgroundPattern: 'grid',
      opensIn: 'plan',
    });
    expect(follower).toMatchObject({
      id: 'b',
      name: 'Backlog',
      theme: 'ocean',
      backgroundColor: '#000',
      backgroundPattern: 'grid',
      defaultTextSize: 'md',
      opensIn: 'plan',
      templateChosen: true,
    });
    // Only the look carries over, never the tab's own state.
    expect(follower).not.toHaveProperty('locked');
  });
});

describe('insertTabsAfter', () => {
  const tabs = [tab('a'), tab('b'), tab('c')];

  it('puts the followers straight after the tab, in order', () => {
    expect(insertTabsAfter(tabs, 'b', [tab('x'), tab('y')]).map((t) => t.id)).toEqual([
      'a',
      'b',
      'x',
      'y',
      'c',
    ]);
  });

  it('appends them when the tab is gone, and changes nothing with none', () => {
    expect(insertTabsAfter(tabs, 'z', [tab('x')]).map((t) => t.id)).toEqual(['a', 'b', 'c', 'x']);
    expect(insertTabsAfter(tabs, 'b', [])).toEqual(tabs);
  });
});

// docs/specs/007-editor/new-document-route.md: Quick Start never replaces work. The builders load
// after the empty check, so a collaborator's element can land on the tab in between.
describe('landTemplateOnTab', () => {
  const build = (target: Tab) => ({
    landed: { ...target, elements: [{ id: 'scaffold' }] as Tab['elements'], templateChosen: true },
    followers: [tab('f')],
  });

  it('lands the template on a still-empty tab and adds its later tabs after it', () => {
    const out = landTemplateOnTab([tab('a'), tab('b')], 'a', build);
    expect(out.map((t) => t.id)).toEqual(['a', 'f', 'b']);
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
});
