import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinnedArrow, createShape } from './factories';
import type { Element } from './index';
import {
  recolourElementsForTheme,
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
  TRUNK_FALLBACK,
} from './theme-graph';
import type { ThemeDefinition } from './themes';
import { THEMES } from './themes-data';

// docs/specs/011-theme/blueprints/multicolour-themes.md: colour resolution (E5, E7, E9),
// the shared branch map (D6) and the wrapper logs (O1, O2).

const theme = (id: string): ThemeDefinition => THEMES.find((t) => t.id === id)!;
const box = (id: string): Element => ({ ...createShape('square', 0, 0), id });
const fillOf = (elements: Element[], id: string) =>
  (elements.find((el) => el.id === id) as { fillColor?: string }).fillColor;

// root -> a, root -> b: the root is trunk, a is branch 0, b is branch 1.
const tree = (): Element[] => [
  box('root'),
  box('a'),
  box('b'),
  createPinnedArrow('root', 's', 'a', 'n'),
  createPinnedArrow('root', 's', 'b', 'n'),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('palette colour resolution', () => {
  it('paints the trunk with the element colours when a palette theme has no rootColor', () => {
    const noRoot: ThemeDefinition = {
      ...theme('rainbow'),
      rootColor: undefined,
      elementFill: '#123456',
    };
    const out = resetThemeElementsToTheme(tree(), noRoot);
    expect(fillOf(out, 'root')).toBe('#123456');
    expect(fillOf(out, 'a')).toBe(noRoot.palette![0]!.fill);
  });

  it('falls back to the named slate trunk for a null element colour', () => {
    const bare: ThemeDefinition = { ...theme('rainbow'), rootColor: undefined, elementFill: null };
    expect(fillOf(resetThemeElementsToTheme(tree(), bare), 'root')).toBe(TRUNK_FALLBACK.fill);
  });

  it('wraps a seventh limb back to the first colour of a six-entry palette', () => {
    const rainbow = theme('rainbow');
    const limbs = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
    const elements: Element[] = [
      box('root'),
      ...limbs.map(box),
      ...limbs.map((id) => createPinnedArrow('root', 's', id, 'n')),
    ];
    expect(rainbow.palette).toHaveLength(6);
    expect(fillOf(resetThemeElementsToTheme(elements, rainbow), 'l6')).toBe(
      rainbow.palette![0]!.fill,
    );
  });

  it('paints everything with the trunk colour and warns once when the palette is empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const empty: ThemeDefinition = { ...theme('rainbow'), palette: [] };
    const out = resetThemeElementsToTheme(tree(), empty);
    for (const id of ['root', 'a', 'b']) expect(fillOf(out, id)).toBe(empty.rootColor!.fill);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[theme-graph] empty palette theme=rainbow, painting trunk');
  });
});

describe('switching between palette themes', () => {
  it('moves each limb to the same branch of the next palette', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    const pastel = theme('pastel');
    const painted = resetThemeElementsToTheme(tree(), rainbow);
    const out = switchThemeElements(painted, rainbow, pastel);
    expect(fillOf(out, 'root')).toBe(pastel.rootColor!.fill);
    expect(fillOf(out, 'a')).toBe(pastel.palette![0]!.fill);
    expect(fillOf(out, 'b')).toBe(pastel.palette![1]!.fill);
  });
});

describe('wrapper logs', () => {
  it('log once per call on a palette theme, naming the operation and counts', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    recolourElementsForTheme(tree(), rainbow);
    switchThemeElements(tree(), rainbow, theme('pastel'));
    resetThemeElementsToTheme(tree(), rainbow);
    resetArrowsToTheme(tree(), rainbow);
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      '[theme-graph] recolour theme=rainbow elements=5 branches=2',
      '[theme-graph] switch theme=pastel elements=5 branches=2',
      '[theme-graph] reset theme=rainbow elements=5 branches=2',
      '[theme-graph] reset-arrows theme=rainbow elements=5 branches=2',
    ]);
  });

  it('stay silent for a single-colour theme', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const single = THEMES.find((t) => !t.palette)!;
    recolourElementsForTheme(tree(), single);
    switchThemeElements(tree(), single, single);
    resetThemeElementsToTheme(tree(), single);
    resetArrowsToTheme(tree(), single);
    expect(info).not.toHaveBeenCalled();
  });
});
