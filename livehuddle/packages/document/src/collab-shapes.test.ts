import { describe, expect, it } from 'vitest';
import {
  supportsMarkers,
  supportsTextAlign,
  CHAIR_FACINGS,
  CHAIR_FACING_LABELS,
  CHAIR_SITTER_FACING,
  hasOwnFace,
  isChairFacing,
  opensInlineLabelEditor,
} from './collab-shapes';
import { carriesSharedSettingsMenu } from './behaviour-shapes';
import { createShape } from './factories';
import type { ShapeKind } from './index';
import { isValidElement } from './validate';

// A kind livehuddle no longer has, as a stored element carries it.
const retired = (kind: string) => kind as ShapeKind;

describe('chair', () => {
  it('accepts only the four facings', () => {
    expect(isChairFacing('n')).toBe(true);
    expect(isChairFacing('ne')).toBe(false);
  });

  it('turns the sitter the way the seat points', () => {
    for (const facing of CHAIR_FACINGS) {
      // The menu label and the sitter's pose must say the same thing.
      expect(CHAIR_FACING_LABELS[facing]).toBe(`Facing ${CHAIR_SITTER_FACING[facing]}`);
    }
  });

  it('creates a valid element and refuses an off-vocabulary facing', () => {
    const el = createShape('chair', 10, 20);
    expect(isValidElement(el)).toBe(true);
    expect(isValidElement({ ...el, chairFacing: 'up' })).toBe(false);
  });
});

describe('the shared settings ellipsis (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/chair.md)', () => {
  it('is on the Behaviours cards except the furniture and Bring Focus', () => {
    expect(carriesSharedSettingsMenu('chair')).toBe(false);
    expect(carriesSharedSettingsMenu('focus-button')).toBe(false);
    expect(carriesSharedSettingsMenu('mode-button')).toBe(true);
    expect(carriesSharedSettingsMenu('square')).toBe(false);
  });

  it('is not on a retired element, which has no settings', () => {
    expect(carriesSharedSettingsMenu(retired('qa-board'))).toBe(false);
  });
});

describe('hasOwnFace', () => {
  it('is the buttons, the seating, the portal and a retired element', () => {
    for (const kind of [
      'chair',
      'mode-button',
      'focus-button',
      'reaction-pad',
      'portal',
    ] as const) {
      expect(hasOwnFace(kind), kind).toBe(true);
    }
    expect(hasOwnFace(retired('estimate'))).toBe(true);
    expect(hasOwnFace(retired('never-a-kind'))).toBe(true);
    expect(hasOwnFace('square')).toBe(false);
  });
});

describe('opensInlineLabelEditor', () => {
  it('opens on a labelled kind, never on a self-drawing kind or a retired element', () => {
    expect(opensInlineLabelEditor('square')).toBe(true);
    expect(opensInlineLabelEditor('progress-bar')).toBe(false);
    expect(opensInlineLabelEditor(retired('quiz'))).toBe(false);
  });
});

// One text-align gate for the context menu and the quick style panel: a kind
// whose face shows its label as a fixed title has nothing to align.
describe('supportsTextAlign', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    const kinds: ShapeKind[] = [
      'chair',
      'focus-button',
      'reaction-pad',
      'portal',
      'mode-button',
      'stat-row',
      'sticker',
      retired('qa-board'),
    ];
    for (const kind of kinds) {
      expect(supportsTextAlign(kind), kind).toBe(false);
    }
  });

  it('is on for plain shapes and for kinds that render the aligned label', () => {
    // An icon's alignment places its caption around the glyph (docs/specs/010-palette/technology-icons.md).
    for (const kind of ['square', 'circle', 'banner', 'callout', 'page', 'icon'] as const) {
      expect(supportsTextAlign(kind), kind).toBe(true);
    }
  });
});

// Markers decorate a label, so they share the text-align gate's reasoning.
describe('supportsMarkers', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    const kinds: ShapeKind[] = ['mode-button', 'progress-bar', 'stat-row', retired('temperature')];
    for (const kind of kinds) {
      expect(supportsMarkers(kind), kind).toBe(false);
    }
  });

  it('is on for plain shapes', () => {
    for (const kind of ['square', 'circle', 'banner'] as const) {
      expect(supportsMarkers(kind), kind).toBe(true);
    }
  });
});
