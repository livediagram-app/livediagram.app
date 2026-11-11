import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from './factories';
import type { Element } from './index';
import {
  recolourElementsForTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
  TRUNK_FALLBACK,
} from './theme-graph';
import type { ThemeDefinition } from './themes';
import { THEMES } from './themes-data';

// docs/specs/011-theme/blueprints/multicolour-themes.md: colour resolution (E5, E7, E9),
// the shared branch map (D6, in document order since DEFAULTS.md D34) and the wrapper logs (O1, O2).

const theme = (id: string): ThemeDefinition => THEMES.find((t) => t.id === id)!;
const box = (id: string): Element => ({ ...createShape('focus-button', 0, 0), id });
// A stored arrow pinned at both ends: a retired element, which no branch reads (DEFAULTS.md D34).
let arrows = 0;
const createPinnedArrow = (from: string, fromAnchor: 's', to: string, toAnchor: 'n'): Element => ({
  id: `arrow-${++arrows}`,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: fromAnchor },
  to: { kind: 'pinned', elementId: to, anchor: toAnchor },
});
const fillOf = (elements: Element[], id: string) =>
  (elements.find((el) => el.id === id) as { fillColor?: string }).fillColor;

// A stored tree, root -> a, root -> b: painted as three loose boxes in document order (DEFAULTS.md D34 in
// docs/specs/002-project-scope/blueprints), the arrows kept as stored.
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
  it('gives each box the next palette colour in document order, the first box too', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    const out = resetThemeElementsToTheme(tree(), rainbow);
    expect(fillOf(out, 'root')).toBe(rainbow.palette![0]!.fill);
    expect(fillOf(out, 'a')).toBe(rainbow.palette![1]!.fill);
    expect(fillOf(out, 'b')).toBe(rainbow.palette![2]!.fill);
    // The stored arrows keep exactly what they stored.
    const elements = tree();
    expect(resetThemeElementsToTheme(elements, rainbow).slice(3)).toEqual(elements.slice(3));
  });

  it('paints the element colours on an empty palette with no rootColor', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const noRoot: ThemeDefinition = {
      ...theme('rainbow'),
      palette: [],
      rootColor: undefined,
      elementFill: '#123456',
    };
    const out = resetThemeElementsToTheme(tree(), noRoot);
    for (const id of ['root', 'a', 'b']) expect(fillOf(out, id)).toBe('#123456');
  });

  it('falls back to the named slate trunk for a null element colour', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const bare: ThemeDefinition = {
      ...theme('rainbow'),
      palette: [],
      rootColor: undefined,
      elementFill: null,
    };
    expect(fillOf(resetThemeElementsToTheme(tree(), bare), 'root')).toBe(TRUNK_FALLBACK.fill);
  });

  it('wraps a seventh box back to the first colour of a six-entry palette', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    const elements = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'].map(box);
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
  it('moves each box to the same branch of the next palette', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    const pastel = theme('pastel');
    const painted = resetThemeElementsToTheme(tree(), rainbow);
    const out = switchThemeElements(painted, rainbow, pastel);
    expect(fillOf(out, 'root')).toBe(pastel.palette![0]!.fill);
    expect(fillOf(out, 'a')).toBe(pastel.palette![1]!.fill);
    expect(fillOf(out, 'b')).toBe(pastel.palette![2]!.fill);
  });
});

describe('wrapper logs', () => {
  it('log once per call on a palette theme, naming the operation and counts', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const rainbow = theme('rainbow');
    recolourElementsForTheme(tree(), rainbow);
    switchThemeElements(tree(), rainbow, theme('pastel'));
    resetThemeElementsToTheme(tree(), rainbow);
    expect(info.mock.calls.map((c): unknown => c[0])).toEqual([
      '[theme-graph] recolour theme=rainbow elements=5 branches=3',
      '[theme-graph] switch theme=pastel elements=5 branches=3',
      '[theme-graph] reset theme=rainbow elements=5 branches=3',
    ]);
  });

  it('stay silent for a single-colour theme', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const single = THEMES.find((t) => !t.palette)!;
    recolourElementsForTheme(tree(), single);
    switchThemeElements(tree(), single, single);
    resetThemeElementsToTheme(tree(), single);
    expect(info).not.toHaveBeenCalled();
  });
});
