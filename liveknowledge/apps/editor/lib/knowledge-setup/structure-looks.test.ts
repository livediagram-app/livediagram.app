// docs/specs/030-knowledgebase/describe-to-set-up.md "Icons and covers": every icon and cover a starter structure
// names is one the page's pickers offer, so none draws the placeholder or a blank.
import { beforeAll, describe, expect, it } from 'vitest';
import { COVER_GRADIENT_IDS, parseTabCover, parseTabIcon } from '@liveknowledge/document';
import { SETUP_STRUCTURES, type StructurePage } from '@liveknowledge/knowledge';
import {
  ensureIconCatalogs,
  getLoadedIconCatalog,
} from '@liveworkspace/workbench/lib/icon-registry';
import { ICON_CATEGORIES } from '@/lib/icons';

beforeAll(async () => {
  await ensureIconCatalogs();
});

const pagesOf = (pages: readonly StructurePage[]): StructurePage[] =>
  pages.flatMap((page) => [page, ...pagesOf(page.pages)]);
const all = SETUP_STRUCTURES.flatMap((s) => pagesOf(s.pages).map((page) => ({ s, page })));

describe('starter structures looks', () => {
  it('use only icons the picker Icons tab offers, each drawn by the catalogue', () => {
    const offered = new Set(ICON_CATEGORIES.flatMap((c) => c.iconIds));
    const drawn = new Set(getLoadedIconCatalog().map((i) => i.id));
    const used = all.flatMap(({ s, page }) =>
      page.icon ? [{ s, id: page.icon, title: page.title }] : [],
    );
    expect(used.length).toBeGreaterThan(100);
    for (const { s, id, title } of used) {
      expect(offered.has(id), `${s.id}: ${title} uses ${id}`).toBe(true);
      expect(drawn.has(id), `${s.id}: ${title} uses ${id}`).toBe(true);
      expect(parseTabIcon({ iconId: id })).toEqual({ iconId: id });
    }
  });

  it('use only built-in theme gradients for covers, never a picture', () => {
    const covers = all.flatMap(({ page }) => (page.cover ? [page.cover] : []));
    expect(covers.length).toBeGreaterThan(100);
    for (const cover of covers) {
      expect(COVER_GRADIENT_IDS as readonly string[]).toContain(cover);
      expect(parseTabCover({ gradient: cover })).toEqual({ gradient: cover });
    }
  });
});
