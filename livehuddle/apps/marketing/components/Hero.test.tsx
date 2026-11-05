import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';
import { FLOOR_STAGES, floorArtHref } from './hero-space-floor-cast';
import { timelineOf } from './hero-space-floor-motion';

// docs/specs/019-marketing/marketing-site.md "Hero": the pitch and its two calls to action standing on a Space's
// floor, the furniture round them and the team walking about and talking, drawn on the server and moved by CSS alone.

const html = renderToStaticMarkup(<Hero />);

describe('the hero', () => {
  it('pitches meeting in a Space under its two promise badges', () => {
    expect(html).toContain('>Meet your team in a Space</h1>');
    expect(html).toMatch(/aria-label="Our promises"/);
    expect(html).toContain('Free and open source');
    expect(html).toContain('No sign-up to start');
  });

  it('opens a Space from its own funnel slot, and browses the templates under it', () => {
    expect(html).toMatch(/href="\/new\?via=Home\.Hero"[^>]*>Open a Space/);
    expect(html).toMatch(/href="\/#templates"[^>]*>Browse Templates/);
  });

  it('is a Space itself: no editor window, no script', () => {
    expect(html).not.toContain('Team Pod');
    expect(html).not.toContain('team-pod-light.svg');
    expect(html).not.toContain('<script');
  });

  it.each(FLOOR_STAGES.map((s) => [s.key, s] as const))(
    'draws the %s stage as decoration: its furniture in both appearances, every character and every line',
    (_, stage) => {
      const start = html.indexOf(`style="width:${stage.width}px;height:${stage.height}px"`);
      expect(start).toBeGreaterThan(-1);
      const before = html.slice(0, start);
      expect(
        before
          .slice(before.lastIndexOf('<div'))
          .startsWith('<div aria-hidden="true" class="hsf-stage'),
      ).toBe(true);
      const markup = html.slice(start);
      expect(markup).toContain(`src="${floorArtHref(stage.key, 'light')}"`);
      expect(markup).toContain(`src="${floorArtHref(stage.key, 'dark')}"`);
      for (const walker of stage.cast) {
        expect(markup).toContain(`hsf-${stage.key}-${walker.name.toLowerCase()}`);
        for (const seg of timelineOf(walker))
          if (seg.say) expect(markup).toContain(`>${seg.say}</span>`);
      }
    },
  );

  it('shows the wide stage from sm and the phone’s below it, never both', () => {
    expect(html).toMatch(/class="hsf-stage pointer-events-none select-none [^"]*max-sm:hidden"/);
    expect(html).toMatch(/class="relative mt-6 overflow-hidden sm:hidden"/);
  });
});
