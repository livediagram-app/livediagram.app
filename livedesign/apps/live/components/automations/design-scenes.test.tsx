// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "The screen": livedesign's own triggers each have a picture, drawn from the
// shared parts, decoration only, and the kit builds with them, their panels, its templates and its examples.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DESIGN_TRIGGERS } from '@livedesign/design/automations';
import { TONES } from '@liveworkspace/automations-ui/tile-picker/tile-scene';
import { DESCRIBE_EXAMPLES, DESCRIBE_PLACEHOLDER, DESIGN_AUTOMATIONS_KIT } from './design-kit';
import { DESIGN_TRIGGER_SCENES } from './design-scenes';

const TRIGGERS = DESIGN_TRIGGERS.map((t) => t.kind);

describe('the design’s own pictures', () => {
  it('draws one for each of livedesign’s own triggers, and none else', () => {
    expect(Object.keys(DESIGN_TRIGGER_SCENES).sort()).toEqual([...TRIGGERS].sort());
  });

  it.each(TRIGGERS)('%s moves by the shared classes alone', (kind) => {
    const { container } = render(<>{DESIGN_TRIGGER_SCENES[kind]!({ tone: TONES.orange })}</>);
    expect(container.querySelector('.ats-t')).toBeTruthy();
    // Played forward on hover alone: every moving part rests on a transform it plays from.
    for (const part of container.querySelectorAll<HTMLElement>('.ats-t'))
      expect(part.style.getPropertyValue('--ats-p'), kind).not.toBe('');
  });

  it.each(TRIGGERS)('%s fires its bolt as the trigger is heard', (kind) => {
    const { container } = render(<>{DESIGN_TRIGGER_SCENES[kind]!({ tone: TONES.violet })}</>);
    expect(container.querySelector('.ats-pop.z-10')).toBeTruthy();
  });

  it('has a main and two instances follow it, and puts the agent on a frame', () => {
    const changed = render(
      <>{DESIGN_TRIGGER_SCENES['component_changed']!({ tone: TONES.orange })}</>,
    ).container;
    // The main's button and each instance's: the old face leaving, the new one arriving.
    expect(changed.querySelectorAll('.ats-out')).toHaveLength(3);
    expect(changed.querySelectorAll('.border-dashed')).toHaveLength(2);
    const agent = render(<>{DESIGN_TRIGGER_SCENES['agent_changed']!({ tone: TONES.violet })}</>);
    expect(agent.container.textContent).toContain('Agent');
  });
});

describe('the design’s kit', () => {
  it('builds, with Describe a Rule’s examples in Title Case and a placeholder among them', () => {
    expect(DESIGN_AUTOMATIONS_KIT).toBeTruthy();
    for (const e of DESCRIBE_EXAMPLES)
      expect(e.label, e.label).toMatch(/^([A-Z][a-z]*|to|a|and)( ([A-Z][a-z]*|to|a|and))*$/);
    expect(DESCRIBE_EXAMPLES.map((e) => e.text)).toContain(DESCRIBE_PLACEHOLDER);
  });

  it('offers its own triggers in the pickers, each with its panel', () => {
    const { kinds } = DESIGN_AUTOMATIONS_KIT;
    for (const kind of TRIGGERS) expect(kinds.triggers[kind]?.Panel, kind).toBeTruthy();
    // Add a Tab from a Template is the shared step, offered with the app's templates.
    expect(kinds.actions['add_tab']?.Panel).toBeTruthy();
  });
});
