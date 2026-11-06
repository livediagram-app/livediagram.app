// docs/specs/007-editor/pages-mode.md "An empty page offers a layout, quietly".
import { describe, expect, it } from 'vitest';
import { layOutPages, type Page } from '@livedocuments/document';
import {
  LAYOUT_INVITE_MIN_HEIGHT,
  LAYOUT_INVITE_MIN_WIDTH,
  layoutInviteShows,
  type LayoutInviteContext,
} from './layout-invite';

const [slide, infographic, article, card, locked] = layOutPages([
  { id: 's', orientation: 'landscape', kind: 'slide', size: 'slide' },
  { id: 'i', orientation: 'portrait', kind: 'infographic' },
  { id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' },
  { id: 'c', orientation: 'landscape', kind: 'flashcard', flow: 'g' },
  { id: 'l', orientation: 'landscape', kind: 'slide', size: 'slide', locked: true },
] as Page[]);
const ok: LayoutInviteContext = {
  editable: true,
  placing: false,
  empty: true,
  choosing: false,
  previewing: false,
  layoutsOpen: false,
  zoom: 1,
};

describe('layoutInviteShows', () => {
  it("shows on an Editor's empty slide or infographic page", () => {
    expect(layoutInviteShows(slide!, ok)).toBe(true);
    expect(layoutInviteShows(infographic!, ok)).toBe(true);
  });

  it('never on an article or a flashcard page, nor a locked one', () => {
    expect(layoutInviteShows(article!, ok)).toBe(false);
    expect(layoutInviteShows(card!, ok)).toBe(false);
    expect(layoutInviteShows(locked!, ok)).toBe(false);
  });

  it('steps aside for anything on the page, an armed tool, the kind choice, a preview, an open Layouts, and for a non-Editor', () => {
    for (const off of [
      { empty: false },
      { placing: true },
      { choosing: true },
      { previewing: true },
      { layoutsOpen: true },
      { editable: false },
    ]) {
      expect(layoutInviteShows(slide!, { ...ok, ...off })).toBe(false);
    }
  });

  it('hides where the page on screen is too small to hold it', () => {
    const fits = Math.max(
      LAYOUT_INVITE_MIN_WIDTH / slide!.rect.width,
      LAYOUT_INVITE_MIN_HEIGHT / slide!.rect.height,
    );
    expect(layoutInviteShows(slide!, { ...ok, zoom: fits })).toBe(true);
    expect(layoutInviteShows(slide!, { ...ok, zoom: fits * 0.9 })).toBe(false);
  });
});
