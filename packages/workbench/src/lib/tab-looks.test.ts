import { describe, expect, it } from 'vitest';
import { LOOKS_PER_PAGE, createTabLooks, type TabLookSettings } from './tab-looks';

type Tab = TabLookSettings & { id: string };
type Look = {
  id: 'plain' | 'soft' | 'type';
  theme: string;
  finish: 'flexible' | 'sketch';
  font: string | undefined;
  pattern: string;
  patternOpacity?: number;
};

const LOOKS: Look[] = [
  { id: 'plain', theme: 'brand', finish: 'flexible', font: undefined, pattern: 'grid' },
  {
    id: 'soft',
    theme: 'rose',
    finish: 'sketch',
    font: undefined,
    pattern: 'lines',
    patternOpacity: 0.5,
  },
  { id: 'type', theme: 'mono', finish: 'flexible', font: 'poppins', pattern: 'blank' },
];
const withThemeApplied = (tab: Tab, theme: string): Tab => ({ ...tab, theme });
const looks = createTabLooks<Tab, Look>({ looks: LOOKS, withThemeApplied });

describe('createTabLooks', () => {
  it('holds six looks to a carousel page', () => {
    expect(LOOKS_PER_PAGE).toBe(6);
  });

  it('finds a look by id', () => {
    expect(looks.tabLookById('soft')?.theme).toBe('rose');
    expect(looks.tabLookById('nope')).toBeUndefined();
  });

  it('applies a look: theme, finish, pattern, its strength and its font', () => {
    const soft = looks.withLookApplied({ id: 't', font: 'inter', backgroundOpacity: 1 }, LOOKS[1]!);
    expect(soft).toEqual({
      id: 't',
      theme: 'rose',
      finish: 'sketch',
      backgroundPattern: 'lines',
      backgroundOpacity: 0.5,
    });
    const typed = looks.withLookApplied({ id: 't', backgroundOpacity: 0.3 }, LOOKS[2]!);
    expect(typed.font).toBe('poppins');
    expect(typed.backgroundOpacity).toBe(0.3);
  });

  it('reads unset settings as what they draw, and a strength only where the look sets one', () => {
    expect(looks.activeLookId({})).toBe('plain');
    expect(
      looks.activeLookId({
        theme: 'rose',
        finish: 'sketch',
        backgroundPattern: 'lines',
        backgroundOpacity: 0.5,
      }),
    ).toBe('soft');
    expect(
      looks.lookMatches({ theme: 'rose', finish: 'sketch', backgroundPattern: 'lines' }, LOOKS[1]!),
    ).toBe(false);
    expect(looks.activeLookId({ theme: 'mono', backgroundPattern: 'blank' })).toBeUndefined();
  });

  it('compares patterns the editor way when it says how', () => {
    const floors = createTabLooks<Tab, Look>({
      looks: LOOKS,
      withThemeApplied,
      samePattern: (look, tab) =>
        (look === 'grid' ? 'floor' : look) === (tab === 'dots' ? 'floor' : tab),
    });
    expect(floors.activeLookId({ backgroundPattern: 'dots' })).toBe('plain');
    expect(looks.activeLookId({ backgroundPattern: 'dots' })).toBeUndefined();
  });
});
