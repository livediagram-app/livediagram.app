import { describe, expect, it } from 'vitest';
import {
  canvasSurface,
  contrastRatio,
  getBuiltInTheme,
  THEMES,
  type Appearance,
} from '@liveplanner/project';
import {
  HEADER_INK_CONTRAST,
  overviewHeaderPaint,
  overviewHeaderVars,
} from './overview-header-paint';

const APPEARANCES: Appearance[] = ['light', 'dark'];

describe('overviewHeaderPaint', () => {
  // Every theme, in both halves: the header's words read on its paper and on its accent wash.
  it.each(THEMES.flatMap((t) => APPEARANCES.map((a) => [t.id, a] as const)))(
    '%s (%s) keeps its words readable',
    (id, appearance) => {
      const theme = getBuiltInTheme(id, appearance);
      const paint = overviewHeaderPaint(theme, canvasSurface(theme.backgroundColor));
      for (const ground of [paint.paper, paint.wash, paint.washEnd]) {
        for (const ink of [paint.ink, paint.muted, paint.accent]) {
          expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(HEADER_INK_CONTRAST);
        }
      }
    },
  );

  it('follows the theme: different themes paint different headers', () => {
    const papers = new Set(
      ['brand', 'midnight', 'rainbow', 'ocean'].map(
        (id) => overviewHeaderPaint(getBuiltInTheme(id, 'light'), 'light').accent,
      ),
    );
    expect(papers.size).toBeGreaterThan(1);
  });

  it('rules a multicolour theme in its branch colours, a single-colour one in its accent', () => {
    const rainbow = THEMES.find((t) => (t.palette?.length ?? 0) > 1);
    expect(rainbow).toBeDefined();
    const multi = overviewHeaderPaint(rainbow!, 'light');
    expect(multi.rule.length).toBe(rainbow!.palette!.length);
    const single = overviewHeaderPaint(getBuiltInTheme('brand', 'light'), 'light');
    expect(single.rule).toHaveLength(1);
    expect(String(overviewHeaderVars(multi)['--ov-head-rule' as never])).toMatch(
      /^linear-gradient/,
    );
  });
});
