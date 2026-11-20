import { describe, expect, it } from 'vitest';
import * as documents from './livedocuments';
import * as knowledge from './liveknowledge';

const pathOf = (a: { categorySlug: string; slug: string }) => `${a.categorySlug}/${a.slug}`;

// liveknowledge's interim slice (liveknowledge/docs/specs/016-platform/platform-registration.md "Help centre"):
// livedocuments' help under liveknowledge's name, until liveknowledge is a help scope of its own.
describe('liveknowledge’s help slice', () => {
  it('holds livedocuments’ articles and categories, at the same paths and in the same order', () => {
    expect(knowledge.articles.map(pathOf)).toEqual(documents.articles.map(pathOf));
    expect(knowledge.categories.map((c) => [c.slug, c.articleCount])).toEqual(
      documents.categories.map((c) => [c.slug, c.articleCount]),
    );
    expect(knowledge.featureCategories.map((c) => c.slug)).toEqual(
      documents.featureCategories.map((c) => c.slug),
    );
  });

  it('never names livedocuments in what people read', () => {
    const words = [
      ...knowledge.articles.flatMap((a) => [a.title, a.description, a.category, a.group ?? '']),
      ...knowledge.categories.flatMap((c) => [c.title, c.description]),
    ].join('\n');
    expect(words).not.toContain('livedocuments');
    expect(words).toContain('liveknowledge');
    expect(knowledge.categories.find((c) => c.slug === 'about')!.title).toBe('About liveknowledge');
  });

  it('gives the possessive its s', () => {
    expect(knowledge.renamed("livedocuments’ pages and livedocuments' API")).toBe(
      "liveknowledge’s pages and liveknowledge's API",
    );
    expect(knowledge.renamed('livedocuments’s')).toBe('liveknowledge’s');
  });

  it('looks articles up and searches them under the new name', () => {
    const first = knowledge.articles[0]!;
    expect(knowledge.getArticlesByCategory(first.categorySlug)).toContain(first);
    expect(knowledge.searchArticles('liveknowledge').length).toBeGreaterThan(0);
    expect(knowledge.searchArticles('livedocuments')).toEqual([]);
    expect(knowledge.getSubArticles('no-such-article')).toEqual([]);
    expect(knowledge.getCategoryGroups(first.categorySlug).flatMap((g) => g.articles)).toContain(
      first,
    );
    expect(knowledge.articleTelemetryId(first)).toBe(documents.articleTelemetryId(first));
  });
});
