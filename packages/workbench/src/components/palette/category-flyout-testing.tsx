// A stand-in editor's tiles for the category flyout's tests (CategoryFlyout, CategoryFlyoutSide, CategoryBarFlyout):
// every kind a real editor's kit binds, without an editor.
import { vi } from 'vitest';
import type { FlyoutCategory, FlyoutKit, FlyoutTile } from './category-flyout-kit';

export interface TestTile extends FlyoutTile<TestTile> {
  // `side` opens its panel without presets (an opener), `tool` is the editor's own (the Fill tool).
  kind?: 'side' | 'tool';
  needsImage?: boolean;
  dividerAfter?: boolean;
}
export type TestActions = { hasImage: boolean; used: string[] };
export type TestPending = string | null;

const tile = (id: string, extra: Partial<TestTile> = {}): TestTile => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  description: `Adds a ${id}. Double-click to edit it.`,
  icon: <svg data-icon={id} />,
  ...extra,
});

export const SQUARE = tile('square', { shortcut: 'R', dividerAfter: true });
export const CIRCLE = tile('circle', { disabled: { reason: 'Not here' }, shortcut: 'O' });
export const PHOTO = tile('photo', { needsImage: true });
export const STAR = tile('star');
export const CARD = tile('card', {
  variants: [
    tile('plain-card', { blurb: 'A plain card.' }),
    tile('photo-card', { needsImage: true }),
  ],
});
export const DEVICES = tile('devices', {
  variants: [tile('phone'), tile('tablet')],
  parentOf: 'devices',
  variantsHint: 'Frames to set a screen design in.',
});
export const OPENER = tile('aws', { kind: 'side', blurb: 'Amazon’s marks.' });
export const FILL = tile('fill', { kind: 'tool' });
export const NOTE = tile('note', { shortcut: 'N' });
export const LASSO = tile('lasso', { kind: 'side' });
export const LOCKED = tile('locked', { disabled: { reason: 'Locked' } });

/** A grid category (Shapes, its two groups named), a card category, a short card category and a catalogue. */
export const CATEGORIES: (FlyoutCategory<TestTile> & { group?: number })[] = [
  {
    id: 'shapes',
    label: 'Shapes',
    description: 'Shapes to draw.',
    icon: <svg />,
    tiles: [SQUARE, CIRCLE, PHOTO, STAR, LASSO],
    content: null,
  },
  {
    id: 'build',
    label: 'Build',
    description: 'Blocks.',
    icon: <svg />,
    tiles: [CARD, DEVICES, OPENER, FILL, NOTE, LOCKED],
    content: null,
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Pictures.',
    icon: <svg />,
    tiles: [NOTE],
    content: null,
    group: 1,
  },
  {
    id: 'icons',
    label: 'Icons',
    description: 'Every icon.',
    icon: <svg />,
    tiles: null,
    content: <p>Browse every icon</p>,
    group: 1,
  },
];

export function testKit(
  over: Partial<FlyoutKit<TestTile, TestActions, TestPending>> = {},
): FlyoutKit<TestTile, TestActions, TestPending> {
  return {
    displayName: (d) => d.label,
    visible: (tiles, actions) => tiles.filter((t) => !t.needsImage || actions.hasImage),
    press: vi.fn((d: TestTile, actions: TestActions) => {
      actions.used.push(d.id);
    }),
    active: (d, pending) => pending === d.id,
    dragStart: (d) => (d.id === 'star' ? undefined : vi.fn()),
    dragEnd: vi.fn(),
    useGlyph: (_d, plain) => ({
      glyphStyle: plain ? undefined : { color: 'rgb(1, 2, 3)' },
      glyphClass: plain ? '' : 'tinted ',
    }),
    opensSide: (d) => !!d.variants?.length || !!d.kind,
    footerLine: (d) => (d.kind === 'side' ? `Browse ${d.label}.` : undefined),
    groups: (categoryId, tiles) => {
      if (categoryId !== 'shapes') return [{ id: tiles[0]!.id, title: null, tiles: [...tiles] }];
      const at = tiles.findIndex((t) => t.dividerAfter) + 1;
      return [
        { id: 'basics', title: 'Basics', tiles: tiles.slice(0, at) },
        { id: 'more', title: 'More', tiles: tiles.slice(at) },
      ];
    },
    layout: (categoryId) => (categoryId === 'shapes' ? 'grid' : 'cards'),
    columns: () => 4,
    cardColumns: (count) => (count <= 3 ? 1 : 2),
    tagline: (categoryId, fallback) => (categoryId === 'shapes' ? 'The basics.' : fallback),
    lead: (categoryId) => (categoryId === 'build' ? <p>Your own blocks</p> : null),
    catalogue: (content) => <div data-testid="catalogue">{content}</div>,
    ...over,
  };
}
