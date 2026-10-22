import { describe, expect, it } from 'vitest';
import { isValidTab, parseStrokePoints } from '@liveplanner/document';
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

// The Whiteboard template makes a general tab; there is no whiteboard kind.
describe('buildTemplateTab: the Whiteboard template', () => {
  it('makes a general tab', () => {
    expect(buildTemplateTab('tab-wb', 'Whiteboard', 'whiteboard').kind).toBe('diagram');
  });
});

describe('resolveTemplate', () => {
  it('resolves a catalogue kind and refuses an unknown one', () => {
    expect(resolveTemplate('kanban')).toBe('kanban');
    expect(resolveTemplate('nope')).toBeNull();
  });

  it('lists every kind an agent may build for the refusal, as the catalogue does', () => {
    expect(validTemplateKinds().split(', ')).toEqual(
      templateCatalogue().templates.map((t) => t.kind),
    );
  });

  // docs/specs/030-forms/forms.md "As templates": only the editor starts a form, so an agent's form template was an
  // empty Plan tab with no form. It is refused, saying how the form is made.
  it('refuses a form template, pointing at add_form with its starter', () => {
    expect(TEMPLATES.some((t) => t.kind === 'contact-form')).toBe(true);
    expect(resolveTemplate('contact-form')).toBeNull();
    expect(validTemplateKinds().split(', ')).not.toContain('contact-form');
    expect(closestTemplatesHint('contact-form')).toBe(
      '"contact-form" starts a form, which only the editor makes from a template: make it with add_form (starter "contact"). ',
    );
  });
});

// docs/specs/026-plan/plan-templates.md "How a template with tabs is made".
describe('buildTemplateTabs', () => {
  it('makes every tab of a Plan template, the first named as given, each valid', () => {
    let n = 0;
    const tabs = buildTemplateTabs({ id: 'first', name: 'Mine' }, 'team-retro', () => `t${++n}`);
    expect(tabs.map((t) => [t.id, t.name])).toEqual([
      ['first', 'Mine'],
      ['t1', 'Actions'],
      ['t2', 'Archive'],
      ['t3', 'Overview'],
    ]);
    // A Board tab per board and a Dashboard showing them (docs/specs/026-plan/plan-tabs.md "Templates").
    expect(tabs.map((t) => t.kind)).toEqual(['board', 'board', 'board', 'dashboard']);
    for (const tab of tabs) {
      expect(isValidTab(tab), tab.name).toBe(true);
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

describe('templateTabName', () => {
  const names = templateTabs('hiring-pipeline').map((d) => d.name);

  it('takes the name given, unless it is a later tab’s', () => {
    expect(templateTabName('Hiring', 'hiring-pipeline')).toBe('Hiring');
    expect(templateTabName(` ${names[1]!.toUpperCase()}`, 'hiring-pipeline')).toBe(names[0]);
  });

  it('takes the template’s own first name, else Tab 1, when none is given', () => {
    expect(templateTabName(undefined, 'hiring-pipeline')).toBe(names[0]);
    expect(templateTabName('  ', 'hiring-pipeline')).toBe(names[0]);
    expect(templateTabName(undefined, 'flowchart')).toBe('Tab 1');
  });
});

// docs/specs/015-api/mcp-server.md §4.5: an unknown kind is refused with the ones it most likely meant.
describe('closestTemplateKinds', () => {
  it('offers the kinds with a word starting with a word of it', () => {
    expect(closestTemplateKinds('retro')).toEqual([
      'retrospective',
      'team-retro',
      'four-ls',
      'sailboat',
    ]);
    expect(closestTemplateKinds('Kanban Board')).toContain('kanban');
    expect(closestTemplatesHint('retro')).toBe(
      'Closest: retrospective, team-retro, four-ls, sailboat. ',
    );
  });

  it('offers nothing for a word under 3 letters or one no template has', () => {
    expect(closestTemplateKinds('ab')).toEqual([]);
    expect(closestTemplateKinds('zzzq')).toEqual([]);
    expect(closestTemplatesHint('zzzq')).toBe('');
  });

  it('offers at most CLOSEST_TEMPLATES_MAX', () => {
    expect(closestTemplateKinds('blank')).toHaveLength(CLOSEST_TEMPLATES_MAX);
  });
});
