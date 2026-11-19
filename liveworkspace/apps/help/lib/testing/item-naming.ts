import { describe, expect, it } from 'vitest';
import { articlesFor, categoriesFor } from '@liveworkspace/help-registry/catalogue';
import { SCOPE } from '@/lib/scope.generated';
import { scopedArticleSources } from './scoped-articles';

// The naming rule two apps keep for their help (liveplanner: a project, livedesign: a design; never "document", the
// word for livedocuments' items). Each product's own guard (liveplanner's project-naming, livedesign's
// design-naming) scanned its help app while it had one; the one help centre lives outside those trees, so each
// edition runs this over the words its scope's reader sees: the articles it shows (other apps' notes dropped), and the
// titles, descriptions and category names of its catalogue entries. Search keywords stay out (hidden synonyms, so
// someone typing the other word still finds the guide).
//
// What a reader sees is the prose: code blocks and `inline code` (API paths, the DOM's own name), link targets,
// JSX tags and import lines are no words on the page, and livedocuments' name is the app it is. A line naming every
// app's items together (closing an account deletes "canvases, plans, documents, designs and Spaces") is allowed.
const WORD = /\bdocuments?\b/i;
const EVERY_APP =
  /(canvas(es)?|plans?|projects?),? [^.]*\bdocuments?\b[^.]*\b(designs?|spaces?)\b/i;

/** The line as the page shows it: no inline code, link targets, JSX tags, livedocuments' name or the Community
 *  article's address. */
function visibleText(line: string): string {
  return (
    line
      .replace(/`[^`]*`/g, '')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/<[^>]*>/g, '')
      .replace(/\blivedocuments(\.app)?\b/gi, '')
      // The Community's help address is the same in every app (@liveworkspace/help-registry/community).
      .replace(/finding-community-documents/g, '')
      .replace(/[Dd]ocument(ation|ed|ing)\b/g, '')
  );
}

/** Each line of `source` a reader sees that names the other app's item, as `<label>:<line>: <text>`. */
export function misnamedLines(label: string, source: string): string[] {
  const out: string[] = [];
  let fenced = false;
  source.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('```')) fenced = !fenced;
    if (fenced || /^\s*(import|export) /.test(line)) return;
    const text = visibleText(line);
    if (WORD.test(text) && !EVERY_APP.test(text))
      out.push(`${label}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
  return out;
}

export function describeItemNaming({ item }: { item: string }) {
  describe(`the help calls a ${item} a ${item}`, () => {
    it('in the articles this scope shows', () => {
      const sources = scopedArticleSources();
      expect(sources.length).toBeGreaterThan(50);
      expect(sources.flatMap(({ file, source }) => misnamedLines(file, source))).toEqual([]);
    });

    it("in its catalogue's titles, descriptions and category names", () => {
      const texts = [
        ...articlesFor(SCOPE).flatMap((a) => [
          [`${a.categorySlug}/${a.slug} title`, a.title],
          [`${a.categorySlug}/${a.slug} description`, a.description],
          [`${a.categorySlug}/${a.slug} category`, a.category],
        ]),
        ...categoriesFor(SCOPE).flatMap((c) => [
          [`${c.slug} title`, c.title],
          [`${c.slug} description`, c.description],
        ]),
      ];
      expect(texts.flatMap(([label, text]) => misnamedLines(label!, text!))).toEqual([]);
    });

    it('flags the word and lets the rest through (guard against this test going blind)', () => {
      expect(misnamedLines('x', 'Open the document from Explorer.')).toHaveLength(1);
      expect(misnamedLines('x', 'Call `document.body` or read the documentation.')).toEqual([]);
      expect(
        misnamedLines('x', 'See [the API](/help/developers/working-with-documents/).'),
      ).toEqual([]);
      expect(
        misnamedLines(
          'x',
          'Closing your account deletes your canvases, plans, documents, designs and Spaces.',
        ),
      ).toEqual([]);
      expect(misnamedLines('x', '```\nGET /api/documents\n```')).toEqual([]);
      expect(
        misnamedLines('x', "  path: '/help/collaboration/sharing/finding-community-documents/',"),
      ).toEqual([]);
    });
  });
}
