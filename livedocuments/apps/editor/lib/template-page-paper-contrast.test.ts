import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplate, templateCanvasOverrides } from '@livedocuments/templates';
import {
  THEMES,
  contrastRatio,
  elementPageTones,
  layOutPages,
  pagesOf,
  type Appearance,
  type Tab,
} from '@livedocuments/document';
import { tabAsSeen } from './export-as-seen';
import { withThemeApplied } from './tab-theme-apply';

// docs/specs/011-theme/light-and-dark.md "A page's own paper": a label with no fill of its own is read against the page
// it sits on. Drawing a Pages template in a half must never sink words that read on their page into it: a theme slot can
// share a template's own colour (the Year in Review's pale slate subtitle, a carousel's white words), and that slot's
// colour in the half was drawn instead, dark on a dark cover. Every Pages template, as made and under every theme
// picked in either half, seen in either.

const APPEARANCES: Appearance[] = ['light', 'dark'];
const FLOOR = 4.5;

describe('template labels keep reading on their own page in every half', () => {
  for (const { kind } of TEMPLATES) {
    const overrides = templateCanvasOverrides(kind);
    if (!overrides.pages) continue;
    it(kind, () => {
      const made: Tab = { id: 't', name: 't', elements: buildTemplate(kind, 0, 0), ...overrides };
      const tabs = [
        made,
        ...THEMES.flatMap((t) => APPEARANCES.map((picker) => withThemeApplied(made, t.id, picker))),
      ];
      const problems: string[] = [];
      for (const tab of tabs) {
        const tones = elementPageTones(tab.elements, layOutPages(pagesOf(tab)));
        for (const viewer of APPEARANCES) {
          const seen = tabAsSeen(tab, viewer).elements;
          tab.elements.forEach((el, i) => {
            const stored = (el as { textColor?: string }).textColor;
            const ink = (seen[i] as { textColor?: string }).textColor;
            const tone = tones.get(el.id);
            if (!tone || !stored || !ink || ink === stored) return;
            if (el.type !== 'text') return;
            const before = contrastRatio(stored, tone);
            const after = contrastRatio(ink, tone);
            if (after < FLOOR && after < before)
              problems.push(`${tab.theme} seen ${viewer}: ${el.id} ${stored} -> ${ink} on ${tone}`);
          });
        }
      }
      expect([...new Set(problems)]).toEqual([]);
    });
  }
});
