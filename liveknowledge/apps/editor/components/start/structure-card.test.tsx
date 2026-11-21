// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETUP_STRUCTURES, STRUCTURE_GROUPS } from '@liveknowledge/knowledge';
import { GROUP_TONES, STRUCTURE_EMBLEMS, structureArtRows } from '@liveknowledge/ui';
import { StructurePicture, structureCard } from './structure-card';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen": a card is the structure, not a page, and
// "A card's picture": the knowledgebase it makes, in its group's colour, with its own emblem.
describe('structureCard', () => {
  it('names Blank Knowledgebase and Describe to Set Up, and a structure with its page count', () => {
    expect(structureCard('blank')).toMatchObject({ name: 'Blank Knowledgebase', tag: '1 Page' });
    expect(structureCard('describe').name).toBe('Describe to Set Up');
    expect(structureCard('onboarding')).toMatchObject({ name: 'Onboarding', tag: '11 Pages' });
  });

  it('draws the knowledgebase: its real top pages, the first with subpages chosen and opened', () => {
    const { container } = render(<>{structureCard('team-handbook').picture}</>);
    const art = container.querySelector('[data-structure-art="team-handbook"]')!;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    // The tree: Welcome, Who We Are, then How We Work chosen and opened on its first two subpages.
    expect(art.textContent).toContain('WelcomeWho We AreHow We WorkMeetingsCommunication');
    // The page: the chosen one's title, and its emblem as its icon and on its cover, drawn by one mask.
    expect((art as HTMLElement).style.getPropertyValue('--kb-mark')).toMatch(
      /^url\("data:image\/svg\+xml,/,
    );
    expect(render(<StructurePicture id="nope" />).container.textContent).toBe('');
  });

  it('draws Blank Knowledgebase and Describe to Set Up as the same window', () => {
    const blank = render(<>{structureCard('blank').picture}</>).container;
    expect(blank.querySelector('[data-structure-art="blank"]')?.textContent).toContain(
      'Start Here',
    );
    const describe = render(<>{structureCard('describe').picture}</>).container;
    expect(describe.querySelector('[data-structure-art="describe"]')?.textContent).toContain(
      'Suggested Pages',
    );
  });

  it('keeps a picture small: at most eighteen nodes (sixteen today, the outline was twelve), as a start draws up to thirty-four at once', () => {
    for (const id of ['blank', 'describe', ...SETUP_STRUCTURES.map((s) => s.id)]) {
      const { container, unmount } = render(<>{structureCard(id).picture}</>);
      expect(container.querySelectorAll('*').length, id).toBeLessThanOrEqual(18);
      unmount();
    }
  });
});

describe('the structures’ pictures', () => {
  it('give every structure an emblem of its own, none shared', () => {
    const ids = SETUP_STRUCTURES.map((s) => s.id);
    expect(Object.keys(STRUCTURE_EMBLEMS).sort()).toEqual([...ids].sort());
    const emblems = ids.map((id) => STRUCTURE_EMBLEMS[id]);
    expect(new Set(emblems).size).toBe(ids.length);
  });

  it('give every group a colour, none shared', () => {
    for (const g of STRUCTURE_GROUPS) expect(GROUP_TONES[g.id], g.id).toBeDefined();
    const hues = STRUCTURE_GROUPS.map((g) => GROUP_TONES[g.id]![500]);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('draw no two structures’ trees alike', () => {
    const trees = SETUP_STRUCTURES.map((s) =>
      structureArtRows(s.pages)
        .rows.map((r) => r.title)
        .join('/'),
    );
    expect(new Set(trees).size).toBe(trees.length);
  });

  it('write no em dash in anything a card draws', () => {
    for (const id of ['blank', 'describe', ...SETUP_STRUCTURES.map((s) => s.id)]) {
      const { container, unmount } = render(<>{structureCard(id).picture}</>);
      expect(container.textContent, id).not.toContain('\u2014');
      unmount();
    }
  });
});
