import { canonicalScope } from '@liveworkspace/help-registry';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { TOGETHER, togetherHref } from './together';

const APP_IDS = new Set(APP_SITES.map((s) => s.id));
const appOf = (id: string) => id.replace(/\.app$/, '');

describe('how work moves between the apps', () => {
  it('joins only listed apps, never one with itself', () => {
    for (const card of TOGETHER) {
      for (const id of [...card.from, ...(card.to ?? [])])
        expect(APP_IDS.has(id), card.key).toBe(true);
      for (const id of card.to ?? []) expect(card.from, card.key).not.toContain(id);
    }
  });

  it('links each help card to a real article for one of its apps, on its canonical address', () => {
    for (const card of TOGETHER) {
      if (card.link.kind !== 'help') continue;
      const path = card.link.path;
      const article = allArticles.find((a) => `${a.categorySlug}/${a.slug}` === path);
      expect(article, card.key).toBeDefined();
      const apps = [...card.from, ...(card.to ?? [])].map(appOf);
      expect(
        (article!.apps ?? []).some((a) => apps.includes(a)),
        card.key,
      ).toBe(true);
      expect(card.link.scope, card.key).toBe(canonicalScope(article!, 'all'));
      expect(togetherHref(card.link), card.key).toMatch(new RegExp(`/help/${path}/$`));
    }
  });

  it('has unique keys and Title Case names', () => {
    expect(new Set(TOGETHER.map((c) => c.key)).size).toBe(TOGETHER.length);
    const small = new Set(['a', 'an', 'and', 'as', 'from', 'in', 'of', 'the', 'to']);
    for (const card of TOGETHER)
      for (const [i, word] of card.title.split(' ').entries())
        if (i === 0 || !small.has(word)) expect(word[0], card.title).toBe(word[0]!.toUpperCase());
  });

  it('names no price, paid tier or unlisted connection', () => {
    for (const card of TOGETHER)
      expect(`${card.title} ${card.body}`, card.key).not.toMatch(
        /\b(pro|paid|price|pricing|subscription|mcp)\b|—/i,
      );
  });
});
