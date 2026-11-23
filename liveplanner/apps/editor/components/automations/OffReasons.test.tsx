// @vitest-environment jsdom
// A control the rules limit turns off says why on hover (docs/specs/026-plan/automations.md "Automation Rules"): New
// Rule and each template tile carry the reason as a tooltip, and nothing extra shows while they are on.
import './test-kit';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewRuleMenu } from '@liveworkspace/automations-ui/NewRuleMenu';
import { TemplatesGallery } from '@liveworkspace/automations-ui/TemplatesGallery';
import { addRuleOffWords } from '@liveworkspace/automations-ui/tier/tier-words';

const REASON = addRuleOffWords(3, 'plan');
const hover = (el: Element) => {
  fireEvent.pointerEnter(el, { pointerType: 'mouse' });
  act(() => {
    // Past the kit's hover delay (800 ms).
    vi.advanceTimersByTime(1_000);
  });
};
const tip = () => screen.queryByRole('tooltip')?.textContent ?? null;
const noop = () => undefined;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('why an add control is off', () => {
  it('New Rule says the plan holds all its rules', () => {
    render(
      <NewRuleMenu
        disabled
        offReason={REASON}
        onBlank={noop}
        onTemplates={noop}
        onDescribe={noop}
      />,
    );
    const button = screen.getByRole('button', { name: /New Rule/ });
    expect(button).toHaveProperty('disabled', true);
    hover(button);
    expect(tip()).toBe('This plan holds all 3 of its rules. Delete one to add another.');
  });

  it('New Rule on shows no reason', () => {
    render(
      <NewRuleMenu
        disabled={false}
        offReason={REASON}
        onBlank={noop}
        onTemplates={noop}
        onDescribe={noop}
      />,
    );
    hover(screen.getByRole('button', { name: /New Rule/ }));
    expect(tip()).not.toBe(REASON);
  });

  it('a template tile says the same, and opens nothing', () => {
    const onPick = vi.fn();
    render(<TemplatesGallery onPick={onPick} disabled offReason={REASON} />);
    const tile = screen.getByRole('button', { name: /Overdue Nudge/ });
    hover(tile);
    expect(tip()).toBe(REASON);
    fireEvent.click(tile);
    expect(onPick).not.toHaveBeenCalled();
  });
});
