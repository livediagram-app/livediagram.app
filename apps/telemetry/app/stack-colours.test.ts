import { describe, expect, it } from 'vitest';
import { GROUPS as DASHBOARD } from './DashboardView';
import { GROUPS as EDITING } from './EditingView';
import { GROUPS as EXCEPTIONS } from './ExceptionsView';
import { GROUPS as HELP } from './HelpView';
import { GROUPS as SETTINGS } from './SettingsView';
import { categoryColor } from './event-vocab';
import { isStack, stackDrawsLines } from './metric-series';
import { shade, stackAccent, stackMemberColors } from './stack-colours';

describe('stack colours', () => {
  it('mixes toward white or black', () => {
    expect(shade('#000000', 0.5)).toBe('#808080');
    expect(shade('#ffffff', -0.5)).toBe('#808080');
    expect(shade('#0ea5e9', 0)).toBe('#0ea5e9');
  });

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
    for (const group of [...DASHBOARD, ...EDITING, ...EXCEPTIONS, ...HELP, ...SETTINGS]) {
      for (const item of group.metrics) {
        if (!isStack(item) || !stackDrawsLines(item.members.length)) continue;
        const colors = stackMemberColors(item.members);
        expect(new Set(colors).size, item.title).toBe(colors.length);
      }
    }
  });
});
