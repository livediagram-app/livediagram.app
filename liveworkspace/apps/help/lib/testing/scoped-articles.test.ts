import { describe, expect, it } from 'vitest';
import { articlesFor } from '@liveworkspace/help-registry/catalogue';
import { forScope, scopedArticleFiles, scopedLandingFiles } from './scoped-articles';

// The edition suites' view of the article tree (scoped-articles.ts).
describe('scoped articles', () => {
  it("drops other apps' notes and keeps the scope's, several apps at once included", () => {
    const source = [
      'Shared.',
      '<AppNote app="livediagram">Diagram only.</AppNote>',
      '<AppNote app="liveplanner,livedesign">Planner and design.</AppNote>',
      "<AppNote apps={['livehuddle']}>Huddle.</AppNote>",
    ].join('\n');
    expect(forScope(source, 'liveplanner')).toBe('Shared.\n\n<AppNote app="liveplanner,livedesign">Planner and design.</AppNote>\n');
    expect(forScope(source, 'livehuddle')).toContain('Huddle.');
    expect(forScope(source, 'livehuddle')).not.toContain('Diagram only.');
    expect(forScope(source, 'all')).toBe(source);
  });

  it("lists exactly the scope's articles and only its own category landings", () => {
    expect(scopedArticleFiles('liveplanner')).toHaveLength(articlesFor('liveplanner').length);
    expect(scopedLandingFiles('livediagram')).not.toContain('plan/page.tsx');
    expect(scopedLandingFiles('liveplanner')).toContain('plan/page.tsx');
    for (const scope of ['livediagram', 'all'] as const) {
      expect(scopedLandingFiles(scope)).toContain('page.tsx');
      expect(scopedLandingFiles(scope)).toContain('contact/page.tsx');
    }
  });
});
