import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TownHallBoard } from './hero-townhall-board';

// The Town Hall scene draws the template's own sections in both layouts, every coordinate a number,
// and both cursors with the stops their keyframes (hero-scenes/townhall.css) step through.
describe('town hall scene', () => {
  it.each([false, true])('draws the Q&A board and the kit (portrait %s)', (portrait) => {
    const html = renderToStaticMarkup(
      <svg>
        <TownHallBoard portrait={portrait} />
      </svg>,
    );
    expect(html).not.toContain('NaN');
    for (const text of [
      'Questions for the panel',
      'NOW DISCUSSING',
      'Discussed',
      'TIMER',
      'Applause',
      'How useful was today?',
      'As Daring Seal',
    ]) {
      expect(html).toContain(text);
    }
    // The teammate stops at a vote and the applause pad (--p1..--p3); you at the timer and the
    // board's actions (--p1..--p5).
    expect(html).toMatch(/class="th-mate"[^>]*--p3:/);
    expect(html).not.toMatch(/class="th-mate"[^>]*--p4:/);
    expect(html).toMatch(/class="th-you"[^>]*--p5:/);
  });

  it('keeps the wide layout to its sections, the panel and run of show only there', () => {
    const wide = renderToStaticMarkup(
      <svg>
        <TownHallBoard />
      </svg>,
    );
    const phone = renderToStaticMarkup(
      <svg>
        <TownHallBoard portrait />
      </svg>,
    );
    expect(wide).toContain('Run of show');
    expect(wide).toContain('Facilitator kit');
    expect(phone).not.toContain('Run of show');
    expect(phone).toContain('On the panel: Maya, Dev and Priya');
  });
});
