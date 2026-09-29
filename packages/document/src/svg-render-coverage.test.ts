import { describe, expect, it } from 'vitest';
import { createShape, renderElementsToSvg, type Tab } from './index';
import { SHAPE_KINDS } from './validate';
import type { ShapeKind } from './shape-kind';

// The headless renderer is the last unguarded step in the chain a new shape
// kind has to survive. The union, the runtime SHAPE_KINDS set and the factory
// are each pinned by a test now, and SHAPE_DEFAULT_SIZE is a Record<ShapeKind>
// so the compiler holds it — but nothing checked that a kind can actually be
// DRAWN without a browser.
//
// That path is not cosmetic. renderElementsToSvg backs the SVG / PNG / PDF
// exports, the Explorer's diagram thumbnails, the live image share link, and
// the inline images the MCP server returns. Those run in a Worker, so a kind
// that throws here is a 500 rather than a wonky rectangle, and a kind that
// silently renders nothing is a blank thumbnail nobody gets an error about.
//
// svg-render.test.ts covers the renderer's behaviour in depth — wrapping,
// bounds, backgrounds, layers — across six kinds. This covers all fifty-one
// shallowly, which is the axis it does not.

const ALL = [...SHAPE_KINDS] as ShapeKind[];
const tabOf = (elements: unknown[]) => ({ id: 't', name: 'Tab', elements }) as unknown as Tab;
const renderKind = (k: ShapeKind) => renderElementsToSvg(tabOf([createShape(k, 0, 0)]));

describe('headless rendering, across the whole vocabulary', () => {
  it('walks the real kind list (guard against an empty enumeration)', () => {
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('renders every kind without throwing', () => {
    const threw = ALL.filter((k) => {
      try {
        renderKind(k);
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toEqual([]);
  });

  it('draws something for every kind', () => {
    // A renderer switch with no default arm would return the bare wrapper for
    // an unhandled kind: no error, no mark, an empty thumbnail. Measured
    // against a genuinely empty tab so the threshold means "contributed
    // markup" rather than a guess at a length.
    const empty = renderElementsToSvg(tabOf([])).length;
    const silent = ALL.filter((k) => renderKind(k).length - empty < 40);
    expect(silent).toEqual([]);
  });

  it('produces a self-contained SVG document for every kind', () => {
    const malformed = ALL.filter((k) => {
      const svg = renderKind(k);
      return !svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>');
    });
    expect(malformed).toEqual([]);
  });

  it('never emits NaN or undefined into the markup', () => {
    // The classic headless bug: a geometry helper that expects a measured DOM
    // value gets undefined, and the arithmetic downstream yields NaN. Browsers
    // mostly ignore the attribute; a rasteriser draws nothing, so the export
    // and the thumbnail disagree with what the editor showed.
    const dirty = ALL.filter((k) => /NaN|undefined|Infinity/.test(renderKind(k)));
    expect(dirty).toEqual([]);
  });
});
