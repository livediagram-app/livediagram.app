import { describe, expect, it } from 'vitest';
import { THEMES, contrastRatio, type Appearance, type Tab } from '@livedesign/design';
import { tabAsSeen } from './export-as-seen';
import { withThemeApplied } from './tab-theme-apply';

// docs/specs/011-theme/light-and-dark.md "A page's own paper": a label with no fill of its own is read against the page
// it sits on. White or pale slate words someone puts on a dark page share a theme slot's colour, and that slot's colour
// in the half was drawn instead: dark words on the dark page, 1.2:1 to 1.8:1, under most themes.
const APPEARANCES: Appearance[] = ['light', 'dark'];
const PAGE = '#0f172a';
const words = (id: string, y: number, textColor: string) =>
  ({ id, type: 'text', x: -100, y, width: 200, height: 40, label: 'Words', textColor }) as never;
const made = {
  id: 't',
  name: 't',
  kind: 'logo',
  pages: [
    {
      id: 'p1',
      size: 'logo',
      kind: 'logo',
      orientation: 'portrait',
      background: { fill: { kind: 'solid', color: PAGE } },
    },
  ],
  elements: [words('white', -20, '#ffffff'), words('slate', 40, '#cbd5e1')],
} as unknown as Tab;

describe('words on a dark page keep reading in every half', () => {
  it('never draws them into the page, under any theme picked or seen in either half', () => {
    const sunk: string[] = [];
    for (const theme of THEMES)
      for (const picker of APPEARANCES) {
        const tab = withThemeApplied(made, theme.id, picker);
        for (const viewer of APPEARANCES)
          tabAsSeen(tab, viewer).elements.forEach((el, i) => {
            const ink = (el as { textColor?: string }).textColor!;
            const stored = (tab.elements[i] as { textColor?: string }).textColor!;
            if (
              contrastRatio(ink, PAGE) < 4.5 &&
              contrastRatio(ink, PAGE) < contrastRatio(stored, PAGE)
            )
              sunk.push(`${theme.id}/${picker} seen ${viewer}: ${stored} -> ${ink}`);
          });
      }
    expect(sunk).toEqual([]);
  });
});
