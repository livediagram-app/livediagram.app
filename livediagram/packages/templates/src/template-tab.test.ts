import { describe, expect, it } from 'vitest';
import { isValidTab, parseStrokePoints } from '@livediagram/document';
import {
  buildTemplateTab,
  buildTemplateTabs,
  resolveTemplate,
  closestTemplateKinds,
  closestTemplatesHint,
  CLOSEST_TEMPLATES_MAX,
  templateTabName,
  validTemplateKinds,
} from './template-tab';
import { templateTabs } from './build-template';
import { TEMPLATES } from './templates';
import { templateCatalogue } from './template-catalogue';

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
    expect(resolveTemplate('flowchart')).toBe('flowchart');
    expect(resolveTemplate('nope')).toBeNull();
  });

  it('lists every kind an agent may build for the refusal, as the catalogue does', () => {
    expect(validTemplateKinds().split(', ')).toEqual(
      templateCatalogue().templates.map((t) => t.kind),
    );
  });
});

describe('buildTemplateTabs', () => {
  it('makes exactly buildTemplateTab’s one tab', () => {
    const newId = () => 'never';
    // Element ids are fresh each build: compare everything else.
    const shape = (tab: ReturnType<typeof buildTemplateTab>) => ({
      ...tab,
      elements: tab.elements.map(({ id: _id, ...rest }) => rest.type),
    });
    const tabs = buildTemplateTabs({ id: 's', name: 'SWOT' }, 'swot', newId);
    expect(tabs.map(shape)).toEqual([shape(buildTemplateTab('s', 'SWOT', 'swot'))]);
  });

  it('makes one tab for every template', () => {
    for (const { kind } of TEMPLATES) expect(templateTabs(kind), kind).toHaveLength(1);
  });
});

describe('templateTabName', () => {
  it('takes the name given, else Tab 1', () => {
    expect(templateTabName('Hiring', 'flowchart')).toBe('Hiring');
    expect(templateTabName(undefined, 'flowchart')).toBe('Tab 1');
    expect(templateTabName('  ', 'flowchart')).toBe('Tab 1');
  });
});

// docs/specs/015-api/mcp-server.md §4.5: an unknown kind is refused with the ones it most likely meant.
describe('closestTemplateKinds', () => {
  it('offers the kinds with a word starting with a word of it', () => {
    expect(closestTemplateKinds('retro')).toEqual(['retrospective', 'four-ls', 'sailboat']);
    expect(closestTemplateKinds('Org Chart')).toContain('orgchart');
    expect(closestTemplatesHint('retro')).toBe('Closest: retrospective, four-ls, sailboat. ');
  });

  it('offers nothing for a word under 3 letters or one no template has', () => {
    expect(closestTemplateKinds('ab')).toEqual([]);
    expect(closestTemplateKinds('zzzq')).toEqual([]);
    expect(closestTemplatesHint('zzzq')).toBe('');
  });

  it('offers at most CLOSEST_TEMPLATES_MAX', () => {
    expect(closestTemplateKinds('map')).toHaveLength(CLOSEST_TEMPLATES_MAX);
  });
});
