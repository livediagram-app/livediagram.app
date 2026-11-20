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
    expect(forScope(source, 'liveplanner')).toBe(
      'Shared.\n\n<AppNote app="liveplanner,livedesign">Planner and design.</AppNote>\n',
    );
    expect(forScope(source, 'livehuddle')).toContain('Huddle.');
    expect(forScope(source, 'livehuddle')).not.toContain('Diagram only.');
    expect(forScope(source, 'all')).toBe(source);
  });

  it('drops the figure variants a scope does not show', () => {
    const source = [
      'Shared.',
      '<Figure app="livediagram,livedesign" caption="Two apps.">\n  <Scene />\n</Figure>',
      '<Figure app="all" caption="All Apps.">\n  <Scene />\n</Figure>',
      '<Figure caption="Everyone.">\n  <Scene />\n</Figure>',
    ].join('\n');
    expect(forScope(source, 'livedesign')).toContain('Two apps.');
    expect(forScope(source, 'livehuddle')).not.toContain('Two apps.');
    expect(forScope(source, 'livehuddle')).not.toContain('All Apps.');
    expect(forScope(source, 'all')).toContain('All Apps.');
    expect(forScope(source, 'all')).not.toContain('Two apps.');
    for (const scope of ['livehuddle', 'all'] as const)
      expect(forScope(source, scope)).toContain('Everyone.');
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
