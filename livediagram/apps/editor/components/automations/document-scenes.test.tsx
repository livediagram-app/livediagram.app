// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": livediagram's own triggers each have a picture, drawn from the
// shared parts, decoration only, and the kit builds with them, its templates and its examples.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KINDS } from '@livediagram/document/automations';
import { TONES } from '@liveworkspace/automations-ui/tile-picker/tile-scene';
import { DESCRIBE_EXAMPLES, DESCRIBE_PLACEHOLDER, DOCUMENT_AUTOMATIONS_KIT } from './document-kit';
import { DOCUMENT_TRIGGER_SCENES } from './document-scenes';

const OWN = ['poll_ended', 'question_asked', 'agent_changed'];

describe('the document’s own pictures', () => {
  it('draws one for each of livediagram’s own triggers, and none else', () => {
    expect(Object.keys(DOCUMENT_TRIGGER_SCENES).sort()).toEqual([...OWN].sort());
    for (const kind of OWN) expect(KINDS.trigger(kind), kind).toBeTruthy();
  });

  it.each(OWN)('%s moves by the shared classes and fires', (kind) => {
    const Scene = DOCUMENT_TRIGGER_SCENES[kind]!;
    const { container } = render(<>{Scene({ tone: TONES.orange })}</>);
    expect(container.querySelector('.ats-t')).toBeTruthy();
    // Played forward on hover alone: every moving part rests on a transform it plays from.
    for (const part of container.querySelectorAll<HTMLElement>('.ats-t'))
      expect(part.style.getPropertyValue('--ats-p'), kind).not.toBe('');
  });

  it('closes the poll, upvotes the question and puts the agent on the canvas', () => {
    const text = (kind: string) =>
      render(<>{DOCUMENT_TRIGGER_SCENES[kind]!({ tone: TONES.violet })}</>).container.textContent;
    expect(text('poll_ended')).toContain('Closed');
    expect(text('question_asked')).toContain('1');
    expect(text('agent_changed')).toContain('Agent');
  });
});

describe('the document’s kit', () => {
  it('builds, with Describe a Rule’s examples in Title Case and a placeholder among them', () => {
    expect(DOCUMENT_AUTOMATIONS_KIT).toBeTruthy();
    for (const e of DESCRIBE_EXAMPLES)
      expect(e.label, e.label).toMatch(/^([A-Z][a-z]*|to|a|and)( ([A-Z][a-z]*|to|a|and))*$/);
    expect(DESCRIBE_EXAMPLES.map((e) => e.text)).toContain(DESCRIBE_PLACEHOLDER);
  });
});
