import { describe, expect, it } from 'vitest';
import { isValidTab, parseStrokePoints } from '@livehuddle/document';
import {
  buildTemplateTab,
  resolveTemplate,
  closestTemplateKinds,
  closestTemplatesHint,
  CLOSEST_TEMPLATES_MAX,
  validTemplateKinds,
} from './template-tab';
import { TEMPLATES } from './templates';
import { templateCatalogue } from './template-catalogue';

// What the MCP writes from a template must be a tab the api accepts, any strokes packed
// (docs/specs/006-document/stroke-points.md).
describe('buildTemplateTab', () => {
  it('builds every template as a valid tab, with packed strokes', () => {
    for (const { kind } of TEMPLATES) {
      const tab = buildTemplateTab(`tab-${kind}`, kind, kind);
      expect(isValidTab(tab), kind).toBe(true);
      for (const el of tab.elements) {
        if (el.type !== 'freehand') continue;
        expect(parseStrokePoints(el.packedPoints).ok, kind).toBe(true);
      }
    }
  });
});

// docs/specs/007-editor/templates-by-mode.md: every template makes a general tab that opens on a meeting board; there is
// no whiteboard kind.
describe('buildTemplateTab: every template opens on a meeting board', () => {
  it('makes the blank a general tab that opens on a meeting board', () => {
    const tab = buildTemplateTab('tab-b', 'Blank', 'blank-session');
    expect(tab.kind).toBe('diagram');
    expect(tab.opensIn).toBe('workshop');
    // An agent's blank tab has the blank's Avatar Pad (docs/specs/009-elements/avatar-pad.md "Every Space and blank
    // tab has one").
    expect(tab.elements.map((e) => e.type === 'shape' && e.shape)).toEqual(['avatar-pad']);
  });
});

describe('resolveTemplate', () => {
  it('resolves a catalogue kind and refuses an unknown one', () => {
    expect(resolveTemplate('team-pod')).toBe('team-pod');
    expect(resolveTemplate('nope')).toBeNull();
  });

  it('lists every kind an agent may build for the refusal, as the catalogue does', () => {
    expect(validTemplateKinds().split(', ')).toEqual(
      templateCatalogue().templates.map((t) => t.kind),
    );
  });
});

// livediagram/docs/specs/015-api/mcp-server.md §4.5: an unknown kind is refused with the ones it most likely meant.
describe('closestTemplateKinds', () => {
  it('offers the kinds with a word starting with a word of it', () => {
    expect(closestTemplateKinds('space')).toEqual(['blank-session', 'coworking-space']);
    expect(closestTemplateKinds('Team Room')).toContain('team-pod');
    expect(closestTemplatesHint('space')).toBe('Closest: blank-session, coworking-space. ');
    // A template that left (Work Tracker #423) is offered nothing close.
    expect(closestTemplateKinds('retro')).toEqual([]);
  });

  it('offers nothing for a word under 3 letters or one no template has', () => {
    expect(closestTemplateKinds('ab')).toEqual([]);
    expect(closestTemplateKinds('zzzq')).toEqual([]);
    expect(closestTemplatesHint('zzzq')).toBe('');
  });

  it('offers at most CLOSEST_TEMPLATES_MAX', () => {
    expect(closestTemplateKinds('blank virtual coworking team hall extra')).toHaveLength(
      CLOSEST_TEMPLATES_MAX,
    );
  });
});
