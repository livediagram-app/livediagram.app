// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The rule builder": in the Add an Action picker the arrow keys move between
// tiles, walking past a full group's dimmed tiles (which take no focus) rather than stopping at them.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addActionHeroArt } from './AddActionHeroArt';
import { StepPicker, type PickerSection } from './StepPicker';

afterEach(cleanup);

const tile = (key: string) => ({ key, name: key, line: `${key} line`, icon: null, scene: null });
const SECTIONS: PickerSection<string>[] = [
  { id: 'a', name: 'Cards', tiles: [tile('move'), tile('flag')] },
  {
    id: 'b',
    name: 'Other Tools',
    full: 'A rule holds up to 5 outgoing actions',
    tiles: [tile('slack'), tile('teams')],
  },
  { id: 'c', name: 'AI', tiles: [tile('summarise')] },
];
const at = (key: string) =>
  document.querySelector<HTMLButtonElement>(`[data-picker-tile="${key}"]`)!;

function Picker({ sections = SECTIONS }: { sections?: PickerSection<string>[] }) {
  return (
    <StepPicker
      title="Add an Action"
      line="What should this rule do to the card?"
      art={addActionHeroArt}
      noun="action"
      emptyHint="Try another word."
      sections={sections}
      onPick={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

describe('the picker’s arrow keys', () => {
  it('stay on the last open tile when only a full group follows it', () => {
    render(<Picker sections={SECTIONS.slice(0, 2)} />);
    at('flag').focus();
    fireEvent.keyDown(at('flag'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(at('flag'));
  });

  it('walk past a full group’s tiles both ways, and stop at the last tile', () => {
    render(
      <StepPicker
        title="Add an Action"
        line="What should this rule do to the card?"
        art={addActionHeroArt}
        noun="action"
        emptyHint="Try another word."
        sections={SECTIONS}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(at('slack').disabled).toBe(true);
    at('flag').focus();
    fireEvent.keyDown(at('flag'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(at('summarise'));
    fireEvent.keyDown(at('summarise'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(at('summarise'));
    fireEvent.keyDown(at('summarise'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(at('flag'));
  });
});

describe('the group chips on a phone', () => {
  it('keep a dark border on hover in dark mode, never the light one', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('max-width'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Picker />);
    const chips = [...document.querySelectorAll<HTMLButtonElement>('[role=group] button')];
    expect(chips.length).toBe(4);
    for (const chip of chips.filter((c) => c.getAttribute('aria-pressed') === 'false'))
      expect(chip.className).toContain('dark:hover:border-slate-600');
    vi.unstubAllGlobals();
  });
});
