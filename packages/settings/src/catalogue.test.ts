import { describe, expect, it } from 'vitest';
import {
  deriveCatalogue,
  readChoiceValue,
  readSliderValue,
  readToggleValue,
  storedPatch,
  type CatalogueChoice,
  type CatalogueSlider,
  type CatalogueToggle,
  type SourceCategory,
} from './catalogue';

type Prefs = Record<string, unknown>;
const presentation = (p: Prefs) => ({
  loop: false,
  speed: 'normal',
  ...(p.presentation as Prefs | undefined),
});

const SOURCE: SourceCategory[] = [
  {
    id: 'editor',
    label: 'Editor',
    rows: [
      {
        kind: 'toggle',
        key: 'guides',
        label: 'Guides',
        description: 'Snap lines.',
        section: 'Canvas',
        read: (p) => p.guides !== false,
        write: (p, v) => ({ ...p, guides: v }),
      },
      {
        // Inverted: the switch offers the tour, the preference records it seen.
        kind: 'toggle',
        key: 'tourSeen',
        label: 'Tour',
        description: 'Offer it again.',
        read: (p) => p.tourSeen !== true,
        write: (p, v: boolean) => ({ ...p, tourSeen: !v }),
      },
      {
        // Shared: the main page's, not the dialog's.
        kind: 'toggle',
        key: 'reduceMotion',
        label: 'Reduce Motion',
        description: 'Shared.',
        read: (p) => p.reduceMotion === true,
        write: (p, v) => ({ ...p, reduceMotion: v }),
      },
      {
        // Writes a list: left to the app.
        kind: 'toggle',
        key: 'tours',
        label: 'Tours',
        description: 'A list.',
        read: (p) => Array.isArray(p.tours),
        write: (p, v) => ({ ...p, tours: v ? [] : ['a'] }),
      },
      { kind: 'appearance', key: 'appearance', label: 'Appearance', description: 'Device.' },
      {
        kind: 'toggle',
        key: 'powerOnly',
        label: 'Power only',
        description: 'Power users.',
        available: (ctx) => ctx.powerUserMode === true,
        read: (p) => p.powerOnly === true,
        write: (p, v) => ({ ...p, powerOnly: v }),
      },
      {
        kind: 'toggle',
        key: 'guestOnly',
        label: 'Guests',
        description: 'Never for a signed-in person.',
        available: (ctx) => !ctx.signedIn,
        read: (p) => p.guestOnly === true,
        write: (p, v) => ({ ...p, guestOnly: v }),
      },
    ],
  },
  {
    id: 'presenting',
    label: 'Presenting',
    parent: 'editor',
    rows: [
      {
        kind: 'toggle',
        key: 'presentation-loop',
        label: 'Loop',
        description: 'Start again.',
        read: (p) => presentation(p).loop,
        write: (p, v) => ({ ...p, presentation: { ...presentation(p), loop: v } }),
      },
      {
        kind: 'choice',
        key: 'presentation-speed',
        label: 'Speed',
        description: 'How long.',
        parent: 'presentation-loop',
        options: [
          { id: 'quick', label: 'Quick' },
          { id: 'normal', label: 'Normal' },
        ],
        read: (p) => presentation(p).speed,
        write: (p, v: string) => ({ ...p, presentation: { ...presentation(p), speed: v } }),
      },
      {
        kind: 'slider',
        key: 'zoom',
        label: 'Zoom',
        description: 'How big.',
        min: 0.5,
        max: 1,
        step: 0.25,
        format: (v) => `${v * 100}%`,
        read: (p) => (typeof p.zoom === 'number' ? p.zoom : 1),
        write: (p, v: number) => ({ ...p, zoom: v }),
      },
    ],
  },
  { id: 'empty', label: 'Empty', rows: [] },
];

describe('deriveCatalogue', () => {
  const catalogue = deriveCatalogue(SOURCE);
  const rows = catalogue.categories.flatMap((category) => category.rows);

  it("keeps the app's categories and rows in order, naming a sub-category by its path", () => {
    expect(catalogue.categories.map((c) => c.label)).toEqual(['Editor', 'Editor › Presenting']);
    expect(rows.map((row) => row.id)).toEqual([
      'guides',
      'tourSeen',
      'powerOnly',
      'presentation-loop',
      'presentation-speed',
      'zoom',
    ]);
  });

  it('pins each row to its stored value, including inverted switches and object fields', () => {
    expect(rows[0]).toMatchObject({ key: 'guides', on: true, off: false, fallback: true });
    expect(rows[0]).toHaveProperty('section', 'Canvas');
    expect(rows[1]).toMatchObject({ key: 'tourSeen', on: false, off: true, fallback: true });
    expect(rows[3]).toMatchObject({ key: 'presentation', field: 'loop', on: true, off: false });
    expect(rows[4]).toMatchObject({
      kind: 'choice',
      key: 'presentation',
      field: 'speed',
      fallback: 'normal',
      when: { key: 'presentation', field: 'loop', on: true },
    });
    expect(rows[5]).toMatchObject({
      kind: 'slider',
      key: 'zoom',
      labels: ['50%', '75%', '100%'],
      fallback: 1,
    });
  });

  it('marks a row only offered to power users', () => {
    expect(rows[2]).toMatchObject({ id: 'powerOnly', powerUser: true });
  });

  it('leaves shared keys, lists, non-preferences and unavailable rows to the app', () => {
    const ids = rows.map((row) => row.id);
    for (const id of ['reduceMotion', 'tours', 'appearance', 'guestOnly']) {
      expect(ids).not.toContain(id);
    }
  });
});

describe('reading and writing a row', () => {
  const toggle = { key: 'tourSeen', on: false, off: true, fallback: true } as CatalogueToggle;
  const field = { key: 'presentation', field: 'loop', on: true, off: false, fallback: false };

  it('reads a switch from its stored value, or its fallback', () => {
    expect(readToggleValue({}, toggle)).toBe(true);
    expect(readToggleValue({ tourSeen: true }, toggle)).toBe(false);
    expect(readToggleValue({ tourSeen: 'junk' }, toggle)).toBe(true);
    expect(readToggleValue({ presentation: { loop: true } }, field)).toBe(true);
    expect(readToggleValue({ presentation: 'junk' }, field)).toBe(false);
  });

  it("patches just the row's key, keeping an object's other fields", () => {
    expect(storedPatch({ other: 1 }, toggle, true)).toEqual({ tourSeen: true });
    expect(storedPatch({ presentation: { speed: 'quick' } }, field, true)).toEqual({
      presentation: { speed: 'quick', loop: true },
    });
    expect(storedPatch({ presentation: [1] }, field, true)).toEqual({
      presentation: { loop: true },
    });
  });

  it('reads a choice and a slider, falling back on anything unknown', () => {
    const choice = {
      key: 'speed',
      options: [{ id: 'quick', label: 'Quick', value: 'q' }],
      fallback: 'normal',
    } as CatalogueChoice;
    expect(readChoiceValue({ speed: 'q' }, choice)).toBe('quick');
    expect(readChoiceValue({ speed: 'x' }, choice)).toBe('normal');
    const slider = { key: 'zoom', min: 0.5, max: 1, fallback: 1 } as CatalogueSlider;
    expect(readSliderValue({ zoom: 0.75 }, slider)).toBe(0.75);
    expect(readSliderValue({ zoom: 9 }, slider)).toBe(1);
    expect(readSliderValue({ zoom: 'big' }, slider)).toBe(1);
  });
});
