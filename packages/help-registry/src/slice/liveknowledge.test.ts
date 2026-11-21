import { describe, expect, it } from 'vitest';
import * as knowledge from './liveknowledge';

const pathOf = (a: { categorySlug: string; slug: string }) => `${a.categorySlug}/${a.slug}`;

// liveknowledge's slice of the one help catalogue (liveworkspace/docs/specs/017-help/help-centre.md "liveknowledge"):
// its own articles and the shared ones that name it, in its reading order and its own wording.
describe('liveknowledge’s help slice', () => {
  it('holds only articles that apply to liveknowledge', () => {
    expect(knowledge.articles.length).toBeGreaterThan(50);
    expect(knowledge.articles.filter((a) => !a.apps.includes('liveknowledge'))).toEqual([]);
  });

  it('lists nothing of what a Knowledgebase does not have', () => {
    const paths = knowledge.articles.map(pathOf);
    for (const gone of ['canvas/', 'palette/', 'selection-modes/', 'tabs/', 'pages/'])
      expect(paths.filter((p) => p.startsWith(gone))).toEqual([]);
    const words = knowledge.articles.map((a) => `${a.title} ${a.description}`).join('\n');
    expect(words).not.toMatch(/\b(slides?|infographics?|flashcards?|PowerPoint|presenting)\b/i);
  });

  it('words its shared articles as a Knowledgebase', () => {
    const byPath = new Map(knowledge.articles.map((a) => [pathOf(a), a]));
    expect(byPath.get('getting-started/sharing-your-document')!.title).toBe(
      'Sharing Your Knowledgebase',
    );
    expect(byPath.get('collaboration/sharing/one-tab')!.title).toBe('Sharing One Page');
    expect(knowledge.categories.find((c) => c.slug === 'about')!.title).toBe('About liveknowledge');
  });

  it('looks articles up and searches them', () => {
    const first = knowledge.articles[0]!;
    expect(knowledge.getArticlesByCategory(first.categorySlug)).toContain(first);
    expect(knowledge.searchArticles('knowledgebase').length).toBeGreaterThan(0);
    expect(knowledge.getSubArticles('no-such-article')).toEqual([]);
    expect(knowledge.getCategoryGroups('knowledgebase').map((g) => g.group)).toContain('Trust');
    expect(knowledge.articleTelemetryId(first)).toBe(first.slug);
  });
});
