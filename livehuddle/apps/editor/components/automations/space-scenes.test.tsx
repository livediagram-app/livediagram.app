// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": livehuddle's own triggers and step each have a picture,
// drawn from the shared parts, decoration only, and the kit builds with them, their panels, its templates and its
// examples, offering no comment or action kind (livehuddle has none).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SPACE_ACTIONS, SPACE_TRIGGERS } from '@livehuddle/document/automations';
import { TONES } from '@liveworkspace/automations-ui/tile-picker/tile-scene';
import { DESCRIBE_EXAMPLES, DESCRIBE_PLACEHOLDER, SPACE_AUTOMATIONS_KIT } from './space-kit';
import { SPACE_ACTION_GLYPHS, SPACE_ACTION_SCENES, SPACE_TRIGGER_SCENES } from './space-scenes';

const TRIGGERS = SPACE_TRIGGERS.map((t) => t.kind);
const ACTIONS = SPACE_ACTIONS.map((a) => a.kind);
const SCENES = { ...SPACE_TRIGGER_SCENES, ...SPACE_ACTION_SCENES };

describe('the Space’s own pictures', () => {
  it('draws one for each of livehuddle’s own triggers and steps, and none else', () => {
    expect(Object.keys(SPACE_TRIGGER_SCENES).sort()).toEqual([...TRIGGERS].sort());
    expect(Object.keys(SPACE_ACTION_SCENES).sort()).toEqual([...ACTIONS].sort());
    expect(Object.keys(SPACE_ACTION_GLYPHS).sort()).toEqual([...ACTIONS].sort());
  });

  it.each(Object.keys(SCENES))('%s moves by the shared classes alone', (kind) => {
    const { container } = render(<>{SCENES[kind]!({ tone: TONES.orange })}</>);
    expect(container.querySelector('.ats-t')).toBeTruthy();
    // Played forward on hover alone: every moving part rests on a transform it plays from.
    for (const part of container.querySelectorAll<HTMLElement>('.ats-t'))
      expect(part.style.getPropertyValue('--ats-p'), kind).not.toBe('');
    // No timers or keyframes of its own: transform and opacity through the shared classes.
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
  });

  it.each(TRIGGERS)('%s fires its bolt as the trigger is heard', (kind) => {
    const { container } = render(<>{SPACE_TRIGGER_SCENES[kind]!({ tone: TONES.violet })}</>);
    expect(container.querySelector('.ats-pop.z-10')).toBeTruthy();
  });

  it('brings the lights up on an arrival, runs the clock down on a departure, and empties the box', () => {
    const draw = (kind: string) => render(<>{SCENES[kind]!({ tone: TONES.orange })}</>).container;
    // The lights come up as someone arrives, and go down as the last one leaves.
    expect(draw('someone_arrived').querySelector('.ats-in .bg-orange-500')).toBeTruthy();
    expect(draw('everyone_left').querySelector('.ats-out .bg-orange-500')).toBeTruthy();
    expect(draw('everyone_left').textContent).toContain('min');
    expect(draw('clear_suggestions').textContent).toContain('Empty');
    // Three notes lift out of the box as it is cleared.
    expect(draw('clear_suggestions').querySelectorAll('.ats-out.bg-amber-200')).toHaveLength(3);
  });

  it('draws the step’s icon', () => {
    for (const kind of ACTIONS) {
      const Glyph = SPACE_ACTION_GLYPHS[kind]!;
      expect(render(<Glyph aria-hidden />).container.querySelector('svg'), kind).toBeTruthy();
    }
  });
});

describe('the Space’s kit', () => {
  it('builds, with Describe a Rule’s examples in Title Case, the nightly reset first and the placeholder', () => {
    expect(SPACE_AUTOMATIONS_KIT).toBeTruthy();
    for (const e of DESCRIBE_EXAMPLES)
      expect(e.label, e.label).toMatch(/^([A-Z][a-z]*|to|a|and)( ([A-Z][a-z]*|to|a|and))*$/);
    expect(DESCRIBE_EXAMPLES[0]!.text).toBe(DESCRIBE_PLACEHOLDER);
    expect(DESCRIBE_PLACEHOLDER).toMatch(/snapshot every night/);
  });

  it('offers its own kinds with their panels, Suggestion Dropped and its step with none', () => {
    const { kinds } = SPACE_AUTOMATIONS_KIT;
    expect(kinds.triggers['someone_arrived']?.Panel).toBeTruthy();
    expect(kinds.triggers['everyone_left']?.Panel).toBeTruthy();
    for (const kind of TRIGGERS) expect(kinds.triggers[kind], kind).toBeTruthy();
    for (const kind of ACTIONS) {
      expect(kinds.actions[kind], kind).toBeTruthy();
      expect(kinds.actions[kind]?.glyph, kind).toBe(SPACE_ACTION_GLYPHS[kind]);
    }
    expect(kinds.actionGroups.some((g) => ACTIONS.every((k) => g.kinds.includes(k)))).toBe(true);
    expect(kinds.triggerGroups.some((g) => TRIGGERS.every((k) => g.kinds.includes(k)))).toBe(true);
  });

  it('offers no comment or action trigger, and the shared steps every Space has', () => {
    const { kinds } = SPACE_AUTOMATIONS_KIT;
    const triggers = Object.keys(kinds.triggers);
    for (const kind of [
      'comment_added',
      'thread_resolved',
      'threads_resolved',
      'action_assigned',
      'action_done',
    ])
      expect(triggers, kind).not.toContain(kind);
    for (const kind of ['joined', 'access_requested', 'scheduled', 'edited'])
      expect(triggers, kind).toContain(kind);
    expect(Object.keys(kinds.actions)).toEqual(
      expect.arrayContaining(['revert_snapshot', 'take_snapshot', 'add_tab', 'clear_suggestions']),
    );
  });
});
