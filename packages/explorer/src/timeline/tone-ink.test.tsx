// The Timeline's tone words (the reason line, the calendar's counts) stay readable in both modes, and a card with
// nothing to open fades its picture, never its words.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { makeEvent } from '../test/fakeClient';
import { TONE_INKS, toneColor, toneDarkInk, type TimelineTone } from './model';
import { TimelineCard } from './Timeline';

const TONES: TimelineTone[] = ['danger', 'structural', 'create', 'neutral'];
// The dark card (slate-900) and page (slate-950), and the light card.
const DARK_SURFACES = ['#0f172a', '#020617'];

describe('tone ink', () => {
  it('reads at 4.5:1 or more on a dark card, as on a light one', () => {
    for (const tone of TONES) {
      for (const surface of DARK_SURFACES) {
        expect(contrastRatio(toneDarkInk(tone), surface)).toBeGreaterThanOrEqual(4.5);
      }
      const light = /,\s*(#[0-9a-f]{6})\)\)$/i.exec(toneColor(tone))?.[1];
      expect(contrastRatio(light!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(TONE_INKS).toContain(`dark:[--lw-timeline-ink-${tone}:${toneDarkInk(tone)}]`);
    }
  });

  it('a card with nothing to open keeps its words at full strength and fades only its picture', () => {
    const event = makeEvent(1, { type: 'team_member_removed' });
    render(<TimelineCard event={event} rendered={{ label: 'Member Left', icon: null }} />);
    const card = document.querySelector(`[data-timeline-event="${event.id}"]`)!;
    expect(card.className).not.toContain('opacity-60');
    expect(card.className).toContain(TONE_INKS);
    expect(card.querySelector('.opacity-60')).not.toBeNull();
    expect(screen.getByText('Member Left').closest('.opacity-60')).toBeNull();
  });
});
