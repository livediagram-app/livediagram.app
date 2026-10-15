// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RecentDiagram } from '@livediagram/api-schema';
import { HeroRecent } from './hero-recent';

// Welcome back (docs/specs/019-marketing/returning-visitor.md, "Tiles"): a diagram from a team's library
// carries the team mark before its name; your own carries none.

afterEach(cleanup);

const diagram = (id: string, teamName: string | null): RecentDiagram => ({
  id,
  name: `Doc ${id}`,
  savedAt: Date.now() - 60_000,
  mode: 'diagram',
  teamName,
});

describe('HeroRecent', () => {
  it('marks a team document with the team icon, before its name', () => {
    const { container } = render(
      <HeroRecent
        diagrams={[diagram('team', 'Design'), diagram('own', null)]}
        playing
        onCentre={() => {}}
      />,
    );
    const tiles = container.querySelectorAll('li');
    const mark = tiles[0]!.querySelector('[data-team-mark]')!;
    expect(mark).not.toBeNull();
    expect(mark.nextElementSibling?.textContent).toBe('Doc team');
    expect(tiles[1]!.querySelector('[data-team-mark]')).toBeNull();
  });
});
