// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ADJUSTMENT_IDS } from '@livedesign/photo-engine';
import { PHOTO_ACTIONS } from '@/lib/photo-editor/photo-actions';
import { ActionGlyph, AdjustGlyph } from './photo-menu-icons';

// docs/specs/031-photo/photo-pages.md "The title bar": every row of a photo menu carries its own icon, so no two rows
// of one menu share a glyph (Image Size and Free Transform once did, and three adjustments drew the same sun).
afterEach(cleanup);

const markup = (glyph: React.ReactElement) => {
  const { container, unmount } = render(glyph);
  const html = container.innerHTML;
  unmount();
  return html;
};

const repeats = (rows: { name: string; html: string }[]) => {
  const seen = new Map<string, string>();
  const clash: string[] = [];
  for (const r of rows) {
    const other = seen.get(r.html);
    if (other) clash.push(`${other} / ${r.name}`);
    else seen.set(r.html, r.name);
  }
  return clash;
};

describe('the photo menus’ glyphs', () => {
  // The title bar's menus that draw a command's glyph (the Layer, Edit and View commands live in their panels).
  it.each(['Image', 'Select'] as const)('%s menu: one glyph per row', (menu) => {
    const rows = PHOTO_ACTIONS.filter((a) => a.menu === menu).map((a) => ({
      name: a.id,
      html: markup(<ActionGlyph id={a.id} />),
    }));
    expect(repeats(rows)).toEqual([]);
  });

  it('the adjustments: one glyph per row', () => {
    const rows = ADJUSTMENT_IDS.map((id) => ({ name: id, html: markup(<AdjustGlyph id={id} />) }));
    expect(repeats(rows)).toEqual([]);
  });
});
