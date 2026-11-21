// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": liveknowledge's own triggers and steps each have a picture,
// drawn from the shared parts, decoration only, and the kit builds with them, their panels, its templates and its
// examples.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_ACTIONS, DOCUMENT_TRIGGERS } from '@liveknowledge/document/automations';
import { TONES } from '@liveworkspace/automations-ui/tile-picker/tile-scene';
import { DESCRIBE_EXAMPLES, DESCRIBE_PLACEHOLDER, DOCUMENT_AUTOMATIONS_KIT } from './document-kit';
import {
  DOCUMENT_ACTION_GLYPHS as VERSION_GLYPHS,
  DOCUMENT_ACTION_SCENES as VERSION_ACTION_SCENES,
  DOCUMENT_TRIGGER_SCENES as VERSION_TRIGGER_SCENES,
} from './document-scenes';
import {
  KNOWLEDGE_ACTION_GLYPHS,
  KNOWLEDGE_ACTION_SCENES,
  KNOWLEDGE_TRIGGER_SCENES,
} from './knowledge-scenes';

const TRIGGERS = DOCUMENT_TRIGGERS.map((t) => t.kind);
const ACTIONS = DOCUMENT_ACTIONS.map((a) => a.kind);
const DOCUMENT_TRIGGER_SCENES = { ...KNOWLEDGE_TRIGGER_SCENES, ...VERSION_TRIGGER_SCENES };
const DOCUMENT_ACTION_SCENES = { ...KNOWLEDGE_ACTION_SCENES, ...VERSION_ACTION_SCENES };
const DOCUMENT_ACTION_GLYPHS = { ...KNOWLEDGE_ACTION_GLYPHS, ...VERSION_GLYPHS };
const SCENES = { ...DOCUMENT_TRIGGER_SCENES, ...DOCUMENT_ACTION_SCENES };

describe('the knowledgebase’s own pictures', () => {
  it('draws one for each of liveknowledge’s own triggers and steps, and none else', () => {
    expect(Object.keys(DOCUMENT_TRIGGER_SCENES).sort()).toEqual([...TRIGGERS].sort());
    expect(Object.keys(DOCUMENT_ACTION_SCENES).sort()).toEqual([...ACTIONS].sort());
    expect(Object.keys(DOCUMENT_ACTION_GLYPHS).sort()).toEqual([...ACTIONS].sort());
  });

  it.each(Object.keys(SCENES))('%s moves by the shared classes alone', (kind) => {
    const { container } = render(<>{SCENES[kind]!({ tone: TONES.orange })}</>);
    expect(container.querySelector('.ats-t')).toBeTruthy();
    // Played forward on hover alone: every moving part rests on a transform it plays from.
    for (const part of container.querySelectorAll<HTMLElement>('.ats-t'))
      expect(part.style.getPropertyValue('--ats-p'), kind).not.toBe('');
  });

  it.each(TRIGGERS)('%s fires its bolt as the trigger is heard', (kind) => {
    const { container } = render(<>{DOCUMENT_TRIGGER_SCENES[kind]!({ tone: TONES.violet })}</>);
    expect(container.querySelector('.ats-pop.z-10')).toBeTruthy();
  });

  it('names the version, rolls the page back and puts the agent on the page', () => {
    const text = (kind: string) =>
      render(<>{SCENES[kind]!({ tone: TONES.violet })}</>).container.textContent;
    expect(text('version_named')).toContain('Signed Off');
    expect(text('agent_changed')).toContain('Agent');
    expect(text('name_version')).toContain('Week 47');
    expect(text('restore_version')).toContain('Back');
    expect(text('page_verified')).toContain('Verified');
    expect(text('review_due')).toContain('Review Due');
    expect(text('set_owner')).toContain('PS');
  });

  it('draws the steps’ icons', () => {
    for (const kind of ACTIONS) {
      const Glyph = DOCUMENT_ACTION_GLYPHS[kind]!;
      expect(render(<Glyph aria-hidden />).container.querySelector('svg'), kind).toBeTruthy();
    }
  });
});

describe('the knowledgebase’s kit', () => {
  it('builds, with Describe a Rule’s examples in Title Case and a placeholder among them', () => {
    expect(DOCUMENT_AUTOMATIONS_KIT).toBeTruthy();
    for (const e of DESCRIBE_EXAMPLES)
      expect(e.label, e.label).toMatch(/^([A-Z][a-z]*|to|a|and)( ([A-Z][a-z]*|to|a|and))*$/);
    expect(DESCRIBE_EXAMPLES.map((e) => e.text)).toContain(DESCRIBE_PLACEHOLDER);
  });

  it('offers its own steps with their panels, and its own triggers in the pickers', () => {
    const { kinds } = DOCUMENT_AUTOMATIONS_KIT;
    for (const kind of TRIGGERS) expect(kinds.triggers[kind]?.Panel, kind).toBeTruthy();
    for (const kind of ACTIONS) {
      expect(kinds.actions[kind]?.Panel, kind).toBeTruthy();
      expect(kinds.actions[kind]?.glyph, kind).toBe(DOCUMENT_ACTION_GLYPHS[kind]);
    }
    for (const kind of ACTIONS)
      expect(
        kinds.actionGroups.some((g) => g.kinds.includes(kind)),
        kind,
      ).toBe(true);
    expect(kinds.triggerGroups.map((g) => g.name)).toEqual(
      expect.arrayContaining(['Trust', 'AI Knowledge', 'Versions']),
    );
  });
});
