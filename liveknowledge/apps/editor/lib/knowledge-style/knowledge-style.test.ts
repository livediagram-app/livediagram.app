import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_KNOWLEDGE_STYLE,
  type Element,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { TAB_STYLE_KEYS } from '@liveworkspace/workbench/lib/tab-style-to-all';
import { RETIRED_TAB_STYLE_KEYS } from '@liveknowledge/document';
import { createKnowledgeStyleStore } from './knowledge-style-store';
import {
  KNOWLEDGE_LOOKS,
  KNOWLEDGE_MASHUP_COMBINATIONS,
  activeKnowledgeLookId,
  knowledgeLookById,
  knowledgeLookMatches,
  knowledgeSeasonalLooksFor,
  lookSettingsOf,
  rollKnowledgeMashup,
  withKnowledgeLook,
} from './knowledge-looks';
import { lookPagePreview } from './look-page-preview';
import { knowledgeDarkGround } from './knowledge-accent';
import { createStyleHistory } from './style-history';
import { bindStyleChange, changeKnowledgeStyle } from './style-change';
import { styleOfferedOf, type StyleOfferedInput } from './style-offered';
import { elementsInTheme } from './styled-elements';

// docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style".
const STEEL: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' };
const OCEAN: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'ocean', bodyFont: 'lora' };

afterEach(() => bindStyleChange(null));

describe('the style store', () => {
  it('holds the default until a read says otherwise, and tells its readers only of a change', () => {
    const store = createKnowledgeStyleStore();
    const told = vi.fn();
    store.subscribe(told);
    expect(store.styleOf('kb')).toBe(DEFAULT_KNOWLEDGE_STYLE);
    expect(store.styleOf(null)).toBe(DEFAULT_KNOWLEDGE_STYLE);
    // The default again, or nonsense: nothing changed, nobody is told.
    expect(store.take('kb', undefined)).toBe(false);
    expect(store.take('kb', { ...DEFAULT_KNOWLEDGE_STYLE })).toBe(false);
    expect(told).not.toHaveBeenCalled();
    expect(store.take('kb', STEEL)).toBe(true);
    expect(store.styleOf('kb')).toEqual(STEEL);
    // The same style again keeps the very object every reader holds.
    const held = store.styleOf('kb');
    expect(store.take('kb', { ...STEEL })).toBe(false);
    expect(store.styleOf('kb')).toBe(held);
    expect(told).toHaveBeenCalledTimes(1);
    // Another knowledgebase has its own.
    expect(store.styleOf('other')).toBe(DEFAULT_KNOWLEDGE_STYLE);
  });

  it('knows the open knowledgebase, for an export that has no id to hand', () => {
    const store = createKnowledgeStyleStore();
    store.set('kb', OCEAN);
    expect(store.openStyle()).toBe(DEFAULT_KNOWLEDGE_STYLE);
    store.setOpen('kb');
    expect(store.openStyle()).toEqual(OCEAN);
    store.setOpen(null);
    expect(store.openStyle()).toBe(DEFAULT_KNOWLEDGE_STYLE);
  });
});

describe('a style change as an undo step', () => {
  it('goes back with an undo at its place and comes again with a redo', () => {
    const h = createStyleHistory();
    h.sync(3, 7);
    expect(h.undoing()).toBeNull();
    // The editor pushes a checkpoint (depth 4, branch 8) and records the change against it.
    h.record(DEFAULT_KNOWLEDGE_STYLE, STEEL);
    h.sync(4, 8);
    expect(h.undoing()).toBe(DEFAULT_KNOWLEDGE_STYLE);
    expect(h.redoing()).toBeNull();
    // Undone: the history is one step back, on the same branch.
    h.sync(3, 8);
    expect(h.undoing()).toBeNull();
    expect(h.redoing()).toBe(STEEL);
  });

  it('is not undone by the undo of a later edit, and is forgotten by a new edit below it', () => {
    const h = createStyleHistory();
    h.record(DEFAULT_KNOWLEDGE_STYLE, STEEL);
    h.sync(1, 1);
    // A later edit of a page: depth 2. Undoing it is not the style's step.
    h.sync(2, 2);
    expect(h.undoing()).toBeNull();
    h.sync(1, 2);
    expect(h.undoing()).toBe(DEFAULT_KNOWLEDGE_STYLE);
    // Undone to the start, then something new is typed: the style's step is gone with the redo side.
    h.sync(0, 2);
    expect(h.redoing()).toBe(STEEL);
    h.sync(1, 3);
    expect(h.undoing()).toBeNull();
    expect(h.size()).toBe(0);
  });

  it('keeps two changes made one after the other, each at its own place', () => {
    const h = createStyleHistory();
    h.record(DEFAULT_KNOWLEDGE_STYLE, STEEL);
    h.record(STEEL, OCEAN);
    h.sync(2, 2);
    expect(h.undoing()).toBe(STEEL);
    h.sync(1, 2);
    expect(h.undoing()).toBe(DEFAULT_KNOWLEDGE_STYLE);
    expect(h.redoing()).toBe(OCEAN);
  });
});

describe('the change door', () => {
  it('does nothing for a session it is not bound for', () => {
    expect(changeKnowledgeStyle(STEEL)).toBe(false);
    const change = vi.fn();
    bindStyleChange(change);
    expect(changeKnowledgeStyle(STEEL)).toBe(true);
    expect(change).toHaveBeenCalledWith(STEEL);
  });
});

describe('who is offered Knowledgebase Style', () => {
  const editor: StyleOfferedInput = {
    can: { manageKnowledgebase: true },
    isStructureReadOnly: false,
    hydrated: true,
    embedMode: false,
    workbench: null,
    sessionCommunity: null,
    documentId: 'kb',
  };
  it('is an Editor of the whole knowledgebase', () => {
    expect(styleOfferedOf(editor)).toBe(true);
  });
  it.each([
    // A Participant writes the pages and the tree (isStructureReadOnly false) but never manages the knowledgebase.
    ['a Participant', { can: { manageKnowledgebase: false } }],
    ['a Viewer', { can: { manageKnowledgebase: false }, isStructureReadOnly: true }],
    ['an Editor confined to one page', { isStructureReadOnly: true }],
    ['an embed', { embedMode: true }],
    ['a workbench pane', { workbench: {} }],
    ['a Community visitor', { sessionCommunity: {} }],
    ['a knowledgebase still loading', { hydrated: false }],
    ['no knowledgebase', { documentId: null }],
  ] as const)('is never %s', (_who, over) => {
    expect(styleOfferedOf({ ...editor, ...over })).toBe(false);
  });
});

describe('the looks', () => {
  it('are the platform’s looks cut to a theme and a typeface, Everyday first in the product’s theme', () => {
    expect(KNOWLEDGE_LOOKS[0]).toMatchObject({
      id: 'everyday',
      theme: 'brand',
      font: 'inter',
      description: 'Lime, Inter',
    });
    expect(KNOWLEDGE_LOOKS).toHaveLength(17);
    // No two looks wear the same theme and typeface: a card is selected by them alone.
    const pairs = KNOWLEDGE_LOOKS.map((l) => `${l.theme}:${l.font}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    // No finish, pattern or page background is named on a card.
    for (const look of KNOWLEDGE_LOOKS)
      expect(look.description).not.toMatch(/sketch|marker|professional|flexible|grid|lines|pages/i);
  });

  it('keep the seasonal looks, the season on now first', () => {
    const december = knowledgeSeasonalLooksFor(new Date(2026, 11, 20));
    expect(december).toHaveLength(6);
    expect(december[0]!.season).toBe('christmas');
    expect(knowledgeLookById('fireside')).toMatchObject({
      theme: 'evergreen',
      season: 'christmas',
    });
  });

  it('set the theme and both fonts, keep the size and spacing, and drop a picked accent', () => {
    const before: KnowledgeStyle = {
      ...DEFAULT_KNOWLEDGE_STYLE,
      textSize: 'large',
      lineSpacing: 'relaxed',
      headingStyle: 'ruled',
      accent: '#0ea5e9',
    };
    const boardroom = knowledgeLookById('boardroom')!;
    expect(withKnowledgeLook(before, boardroom)).toEqual({
      theme: 'steel',
      headingFont: 'inter',
      bodyFont: 'inter',
      textSize: 'large',
      lineSpacing: 'relaxed',
      headingStyle: 'ruled',
    });
  });

  it('read as selected while the theme and the typeface are the look’s, and not with two typefaces', () => {
    expect(activeKnowledgeLookId(lookSettingsOf(DEFAULT_KNOWLEDGE_STYLE))).toBe('everyday');
    const editorial = withKnowledgeLook(DEFAULT_KNOWLEDGE_STYLE, knowledgeLookById('editorial')!);
    expect(activeKnowledgeLookId(lookSettingsOf(editorial))).toBe('editorial');
    expect(activeKnowledgeLookId(lookSettingsOf({ ...editorial, textSize: 'small' }))).toBe(
      'editorial',
    );
    expect(
      activeKnowledgeLookId(lookSettingsOf({ ...editorial, headingFont: 'poppins' })),
    ).toBeUndefined();
    expect(activeKnowledgeLookId(lookSettingsOf({ ...editorial, theme: 'ocean' }))).toBeUndefined();
  });

  it('roll a mashup that is never a named look nor the one before', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    expect(KNOWLEDGE_MASHUP_COMBINATIONS).toBeGreaterThan(100);
    let previous = rollKnowledgeMashup({ random });
    for (let i = 0; i < 200; i += 1) {
      const next = rollKnowledgeMashup({ previous, random });
      expect(next.id).toBe('mashup');
      const worn = { theme: next.theme, font: next.font };
      expect(activeKnowledgeLookId(worn)).toBeUndefined();
      expect(knowledgeLookMatches(worn, previous)).toBe(false);
      // Never a seasonal theme.
      expect(['sparkle', 'spring', 'pumpkin', 'yuletide', 'frost', 'evergreen']).not.toContain(
        next.theme,
      );
      previous = next;
    }
  });
});

describe('a look’s card', () => {
  it.each(['light', 'dark'] as const)(
    'is a small page of writing in %s, never a diagram',
    (half) => {
      for (const look of [...KNOWLEDGE_LOOKS, ...knowledgeSeasonalLooksFor(new Date(2026, 3, 1))]) {
        const { markup, paper } = lookPagePreview(
          withKnowledgeLook(DEFAULT_KNOWLEDGE_STYLE, look),
          half,
        );
        expect(paper).toBe(half === 'light' ? '#ffffff' : knowledgeDarkGround(look.theme));
        // A title, a heading, two lines, a link, a quote and a small table.
        expect(markup).toContain('Team Handbook');
        expect(markup).toContain('How We Work');
        expect(markup).toContain('Write it down once');
        expect(markup).toContain('text-decoration="underline"');
        expect(markup).toContain('font-style="italic"');
        expect(markup.match(/<line /g)!.length).toBeGreaterThanOrEqual(3);
        // No arrow, connector or node of a diagram.
        expect(markup).not.toMatch(/<path|marker|<polygon|<circle|<ellipse/);
      }
    },
  );

  it('draws a rule under the heading for the ruled heading style only', () => {
    const plain = lookPagePreview(DEFAULT_KNOWLEDGE_STYLE, 'light').markup;
    const ruled = lookPagePreview(
      { ...DEFAULT_KNOWLEDGE_STYLE, headingStyle: 'ruled' },
      'light',
    ).markup;
    expect(ruled.match(/<rect /g)!.length).toBe(plain.match(/<rect /g)!.length + 1);
  });
});

// The accents themselves are tested beside them (@liveknowledge/document knowledge-style-view.test.ts).
describe('a theme’s dark ground', () => {
  it('stands on the theme’s own dark surface in the dark, the shared dark ground under lime', () => {
    expect(knowledgeDarkGround('brand')).toBe('#131b26');
    expect(knowledgeDarkGround('steel')).toMatch(/^#[0-9a-f]{6}$/);
    expect(knowledgeDarkGround('steel')).not.toBe(knowledgeDarkGround('rose'));
  });
});

describe('a page’s drawings in the knowledgebase’s theme', () => {
  const box = (id: string, extra: object = {}) =>
    ({
      id,
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ...extra,
    }) as unknown as Element;

  it('leaves the stored elements alone under the product’s own theme', () => {
    const stored = [box('a')];
    expect(elementsInTheme(stored, 'brand', 'light')).toBe(stored);
    expect(elementsInTheme(stored, undefined, 'light')).toBe(stored);
  });

  it('draws each unset colour in the theme’s, keeps a picked one, and writes nothing', () => {
    const stored = [box('a'), box('b', { fillColor: '#ff00ff' })];
    const frozen = JSON.stringify(stored);
    const drawn = elementsInTheme(stored, 'steel', 'light');
    expect(drawn).not.toBe(stored);
    expect((drawn[0] as { strokeColor?: string }).strokeColor).toMatch(/^#/);
    expect((drawn[1] as { fillColor?: string }).fillColor).toBe('#ff00ff');
    expect(JSON.stringify(stored)).toBe(frozen);
  });

  it('keeps an unchanged element’s drawn identity across edits, and redraws for another theme or half', () => {
    const a = box('a');
    const b = box('b');
    const first = elementsInTheme([a, b], 'steel', 'light');
    // The same array again: the same answer.
    const again = elementsInTheme([a, b], 'steel', 'light');
    expect(again[0]).toBe(first[0]);
    // An edit moves b: a's drawn object is the one from before.
    const moved = { ...b, x: 10 } as Element;
    const next = elementsInTheme([a, moved], 'steel', 'light');
    expect(next[0]).toBe(first[0]);
    expect(next[1]).not.toBe(first[1]);
    expect(elementsInTheme([a, b], 'ocean', 'light')[0]).not.toBe(first[0]);
    expect(elementsInTheme([a, b], 'steel', 'dark')[0]).not.toBe(first[0]);
  });
});

describe('the tab style keys the platform copies between tabs', () => {
  it('are all retired from a knowledgebase’s tabs, with the theme', () => {
    for (const key of TAB_STYLE_KEYS) expect(RETIRED_TAB_STYLE_KEYS).toContain(key);
    expect(RETIRED_TAB_STYLE_KEYS).toContain('theme');
  });
});
