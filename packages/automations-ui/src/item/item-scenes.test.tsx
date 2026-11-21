// @vitest-environment jsdom
// The pictures (blueprint item-ui.md "Pictures"): every shared trigger and step has one, each is decoration that
// moves by the scenes' classes alone, and a template's picture is its trigger's and its last step's, or the app's.
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sharedActions, sharedTriggers } from '@liveworkspace/automations/item';
import { TONES } from '../tile-picker/tile-scene';
import { ITEM_ACTION_GLYPHS } from './glyphs';
import { actionKeysOf } from './rule-reads';
import { ACTION_SCENES } from './scenes/action-scenes';
import { ItemTemplateScene, TemplatePair } from './scenes/ItemTemplateScene';
import { ACTION_GROUP_TONES, TRIGGER_GROUP_TONES } from './scenes/tones';
import { TRIGGER_SCENES } from './scenes/trigger-scenes';
import { KINDS } from './test/item-fixtures';

afterEach(cleanup);

const MOVING = /\bats-(t|in|out|flow|press)\b/;

describe('the shared pictures', () => {
  it('draws every shared trigger, in every tone, with something that plays', () => {
    const kinds = sharedTriggers(true).map((t) => t.kind);
    expect(Object.keys(TRIGGER_SCENES).sort()).toEqual([...kinds].sort());
    for (const kind of kinds)
      for (const tone of Object.values(TONES)) {
        const { container } = render(<div>{TRIGGER_SCENES[kind]!({ tone })}</div>);
        expect(container.innerHTML, kind).toMatch(MOVING);
        // Art only: nothing a pointer or a keyboard could reach, no words a screen reader is owed.
        expect(container.querySelector('button, a, input, [tabindex]'), kind).toBeNull();
        cleanup();
      }
  });

  it('draws every shared step by its tile key, with its icon', () => {
    const keys = actionKeysOf(KINDS).filter((k) => k !== 'clear_box');
    expect(Object.keys(ACTION_SCENES).sort()).toEqual([...keys].sort());
    expect(Object.keys(ITEM_ACTION_GLYPHS).sort()).toEqual([...keys].sort());
    expect(sharedActions(true).length).toBe(8);
    for (const key of keys) {
      const Glyph = ITEM_ACTION_GLYPHS[key]!;
      const { container } = render(
        <div>
          {ACTION_SCENES[key]!({ tone: TONES.blue })}
          <Glyph size={16} aria-hidden />
        </div>,
      );
      expect(container.innerHTML, key).toMatch(MOVING);
      expect(container.querySelector('svg[aria-hidden]'), key).toBeTruthy();
      cleanup();
    }
  });

  it('colours every shared group', () => {
    for (const tone of [
      ...Object.values(TRIGGER_GROUP_TONES),
      ...Object.values(ACTION_GROUP_TONES),
    ])
      expect(TONES[tone]).toBeTruthy();
  });

  it('moves by CSS alone: no timer, no effect, no state in a scene file', () => {
    for (const file of [
      'scene-bits.tsx',
      'trigger-scenes.tsx',
      'action-scenes.tsx',
      'ItemTemplateScene.tsx',
    ]) {
      const source = readFileSync(join(__dirname, 'scenes', file), 'utf8');
      expect(source, file).not.toMatch(
        /setTimeout|setInterval|requestAnimationFrame|useEffect|useState/,
      );
    }
  });
});

describe('a template’s picture', () => {
  const trigger = () => <i data-half="trigger" />;
  const step = () => <i data-half="step" />;

  it('is its trigger, a line, then its last step a beat later', () => {
    const { container } = render(<ItemTemplateScene tone="blue" trigger={trigger} step={step} />);
    const frame = container.firstElementChild!;
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    const halves = [...frame.querySelectorAll('[data-template-half]')];
    expect(halves.map((h) => h.getAttribute('data-template-half'))).toEqual(['trigger', 'step']);
    expect(halves[1]!.className).toContain('ats-late');
    expect(halves[0]!.className).not.toContain('ats-late');
    expect(frame.querySelector('svg .ats-flow')).toBeTruthy();
  });

  it('draws the trigger alone for a template with no step, and the app’s own in place of both', () => {
    const alone = render(<div>{TemplatePair({ tone: TONES.red, trigger, step: null })}</div>);
    expect(alone.container.querySelectorAll('[data-template-half]')).toHaveLength(1);
    expect(alone.container.querySelector('svg')).toBeNull();
    cleanup();
    const own = render(
      <ItemTemplateScene
        tone="red"
        trigger={trigger}
        step={step}
        scene={() => <b data-own="" />}
      />,
    );
    expect(own.container.querySelector('[data-own]')).toBeTruthy();
    expect(own.container.querySelector('[data-template-pair]')).toBeNull();
  });

  it('has its late half in the scenes’ stylesheet, still under reduced motion', () => {
    const css = readFileSync(join(__dirname, '..', 'automation-scenes.css'), 'utf8');
    expect(css).toMatch(/\.ats-late\s+:is\(\.ats-t, \.ats-in, \.ats-out\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/:root\.reduce-motion \.ats-t/);
  });
});
