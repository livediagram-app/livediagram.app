import { describe, expect, it } from 'vitest';
import { allGroups } from './app';
import { DARK_CARD, DARK_MIN_CONTRAST } from './appearance-colours';
import { contrastRatio } from './colour-maths';
import { categoryColor as colorOf } from './event-vocab';
import { isStack, stackDrawsLines } from './metric-series';
import { stackAccent as accentOf, stackMemberColors as membersOf } from './stack-colours';
import { LIVEDIAGRAM, TEST_APPS } from './test-apps';

type Members = { category: string }[];
type Appearance = 'light' | 'dark';
// The unit checks read livediagram's palette (Folder and Facilitator share a hue there).
const COLORS = LIVEDIAGRAM.categoryColors;
const categoryColor = (c: string, a?: Appearance) => colorOf(COLORS, c, a);
const stackMemberColors = (m: Members, a?: Appearance) => membersOf(m, COLORS, a);
const stackAccent = (m: Members, a?: Appearance) => accentOf(m, COLORS, a);

describe('stack colours', () => {
  it('gives a lone member its category colour and shades a shared one', () => {
    const colors = stackMemberColors([
      { category: 'Document' },
      { category: 'Tab' },
      { category: 'Document' },
    ]);
    expect(colors[1]).toBe(categoryColor('Tab'));
    expect(colors[0]).not.toBe(colors[2]);
    expect(colors[0]).not.toBe(categoryColor('Document'));
  });

  it('splits two categories that share a hue', () => {
    // Folder and Facilitator are both #a855f7.
    const [a, b] = stackMemberColors([{ category: 'Folder' }, { category: 'Facilitator' }]);
    expect(a).not.toBe(b);
  });

  it('takes the accent from the most common hue, the first on a tie', () => {
    expect(
      stackAccent([{ category: 'Tab' }, { category: 'Document' }, { category: 'Document' }]),
    ).toBe(categoryColor('Document'));
    expect(stackAccent([{ category: 'Tab' }, { category: 'Document' }])).toBe(categoryColor('Tab'));
  });
});

describe('stack colours in dark', () => {
  it('gives a lone member and the accent the dark category colour', () => {
    const members = [{ category: 'Page' }, { category: 'Tab' }, { category: 'Page' }];
    expect(stackMemberColors(members, 'dark')[1]).toBe(categoryColor('Tab', 'dark'));
    expect(stackAccent(members, 'dark')).toBe(categoryColor('Page', 'dark'));
  });

  it('shades a shared hue from its dark floor upward', () => {
    const [first, second] = stackMemberColors([{ category: 'Page' }, { category: 'Page' }], 'dark');
    expect(contrastRatio(second!, DARK_CARD)).toBeGreaterThan(contrastRatio(first!, DARK_CARD));
  });
});

// Every stack on every tab of every app's dashboard, in both appearances.
describe.each(TEST_APPS)('$name stacks', ({ config }) => {
  const ALL_GROUPS = allGroups(config);
  const palette = config.categoryColors;
  it('draws every stack on every tab with a distinct line per member', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const group of ALL_GROUPS) {
        for (const item of group.metrics) {
          if (!isStack(item) || !stackDrawsLines(item.members.length)) continue;
          const colors = membersOf(item.members, palette, appearance);
          expect(new Set(colors).size, `${item.title} (${appearance})`).toBe(colors.length);
        }
      }
    }
  });
  it('reads every member line and accent on the dark card', () => {
    for (const group of ALL_GROUPS) {
      for (const item of group.metrics) {
        if (!isStack(item)) continue;
        const colours = [
          ...membersOf(item.members, palette, 'dark'),
          accentOf(item.members, palette, 'dark'),
        ];
        for (const c of colours) {
          expect(contrastRatio(c, DARK_CARD), `${item.title} ${c}`).toBeGreaterThanOrEqual(
            DARK_MIN_CONTRAST,
          );
        }
      }
    }
  });
});
