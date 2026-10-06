import { describe, expect, it } from 'vitest';
import { isValidTab, parseStrokePoints } from '@livediagram/document';
import {
  buildTemplateTab,
  buildTemplateTabs,
  resolveTemplate,
  validTemplateKinds,
} from './template-tab';
import { TEMPLATES } from './templates';

// Templates drawn from sketches (the sailboat scene) carry freehand strokes: what the MCP writes
// from a template must be a tab the api accepts, its strokes packed
// (docs/specs/006-document/stroke-points.md).
describe('buildTemplateTab', () => {
  it('builds every template as a valid tab, with packed strokes', () => {
    let strokes = 0;
    for (const { kind } of TEMPLATES) {
      const tab = buildTemplateTab(`tab-${kind}`, kind, kind);
      expect(isValidTab(tab), kind).toBe(true);
      for (const el of tab.elements) {
        if (el.type !== 'freehand') continue;
        strokes++;
        expect(parseStrokePoints(el.packedPoints).ok, kind).toBe(true);
      }
    }
    expect(strokes).toBeGreaterThan(0);
  });
});

// docs/specs/007-editor/editor-modes.md: the Whiteboard template makes a general tab that opens in
// Draw mode; there is no whiteboard kind.
describe('buildTemplateTab: the Whiteboard template', () => {
  it('makes a general tab that opens in Draw', () => {
    const tab = buildTemplateTab('tab-wb', 'Whiteboard', 'whiteboard');
    expect(tab.kind).toBe('diagram');
    expect(tab.opensIn).toBe('draw');
  });

  it('leaves every other template opening in Diagram', () => {
    expect(buildTemplateTab('tab-b', 'Blank', 'blank').opensIn).toBeUndefined();
  });
});

describe('resolveTemplate', () => {
  it('resolves a catalogue kind and refuses an unknown one', () => {
    expect(resolveTemplate('kanban')).toBe('kanban');
    expect(resolveTemplate('nope')).toBeNull();
  });

  it('lists every kind for the refusal', () => {
    expect(validTemplateKinds().split(', ')).toEqual(TEMPLATES.map((t) => t.kind));
  });
});

// docs/specs/026-plan/plan-templates.md "How a template with tabs is made".
describe('buildTemplateTabs', () => {
  it('makes every tab of a Plan template, the first named as given, each valid and opening in Plan', () => {
    let n = 0;
    const tabs = buildTemplateTabs({ id: 'first', name: 'Mine' }, 'team-retro', () => `t${++n}`);
    expect(tabs.map((t) => [t.id, t.name])).toEqual([
      ['first', 'Mine'],
      ['t1', 'Actions'],
      ['t2', 'Archive'],
    ]);
    for (const tab of tabs) {
      expect(isValidTab(tab), tab.name).toBe(true);
      expect(tab.opensIn).toBe('plan');
      expect(tab.templateChosen).toBe(true);
    }
  });

  it('makes exactly buildTemplateTab’s one tab for any other template', () => {
    const newId = () => 'never';
    // Element ids are fresh each build: compare everything else.
    const shape = (tab: ReturnType<typeof buildTemplateTab>) => ({
      ...tab,
      elements: tab.elements.map(({ id: _id, ...rest }) => rest.type),
    });
    const tabs = buildTemplateTabs({ id: 's', name: 'SWOT' }, 'swot', newId);
    expect(tabs.map(shape)).toEqual([shape(buildTemplateTab('s', 'SWOT', 'swot'))]);
  });
});
