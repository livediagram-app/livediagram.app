import { describe, expect, it } from 'vitest';
import { GROUPS as DASHBOARD } from './DashboardView';
import { GROUPS as EDITING } from './EditingView';
import { GROUPS as EXCEPTIONS } from './ExceptionsView';
import { GROUPS as HELP } from './HelpView';
import { GROUPS as SETTINGS } from './SettingsView';
import { DARK_CARD, DARK_MIN_CONTRAST } from './appearance-colours';
import { contrastRatio } from './colour-maths';
import { categoryColor } from './event-vocab';
import { isStack, stackDrawsLines } from './metric-series';
import { stackAccent, stackMemberColors } from './stack-colours';

const ALL_GROUPS = [...DASHBOARD, ...EDITING, ...EXCEPTIONS, ...HELP, ...SETTINGS];

describe('stack colours', () => {
  it('gives a lone member its category colour and shades a shared one', () => {
    const colors = stackMemberColors([
      { category: 'Diagram' },
      { category: 'Tab' },
      { category: 'Diagram' },
    ]);
    expect(colors[1]).toBe(categoryColor('Tab'));
    expect(colors[0]).not.toBe(colors[2]);
    expect(colors[0]).not.toBe(categoryColor('Diagram'));
  });

  it('splits two categories that share a hue', () => {
    // Folder and Facilitator are both #a855f7.
    const [a, b] = stackMemberColors([{ category: 'Folder' }, { category: 'Facilitator' }]);
    expect(a).not.toBe(b);
  });

  it('takes the accent from the most common hue, the first on a tie', () => {
    expect(
      stackAccent([{ category: 'Tab' }, { category: 'Diagram' }, { category: 'Diagram' }]),
    ).toBe(categoryColor('Diagram'));
    expect(stackAccent([{ category: 'Tab' }, { category: 'Diagram' }])).toBe(categoryColor('Tab'));
  });

  it('draws every stack on every tab with a distinct line per member', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const group of ALL_GROUPS) {
        for (const item of group.metrics) {
          if (!isStack(item) || !stackDrawsLines(item.members.length)) continue;
          const colors = stackMemberColors(item.members, appearance);
          expect(new Set(colors).size, `${item.title} (${appearance})`).toBe(colors.length);
        }
      }
    }
  });
});

describe('stack colours in dark', () => {
  it('reads every member line and accent on the dark card', () => {
    for (const group of ALL_GROUPS) {
      for (const item of group.metrics) {
        if (!isStack(item)) continue;
        const colours = [
          ...stackMemberColors(item.members, 'dark'),
          stackAccent(item.members, 'dark'),
        ];
        for (const c of colours) {
          expect(contrastRatio(c, DARK_CARD), `${item.title} ${c}`).toBeGreaterThanOrEqual(
            DARK_MIN_CONTRAST,
          );
        }
      }
    }
  });

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
