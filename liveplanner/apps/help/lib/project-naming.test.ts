import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// What a person makes in liveplanner is a project, never a "document" (docs/specs/003-system-architecture/domain-language.md
// "Project"): in source, copy, help and docs alike. The word survives only where it is not the container: the browser's
// DOM `document`, the flowchart's document shape, and the search words of the page element and paper icons.
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const SCANNED =
  /^(apps|packages|docs)\/.*\.(ts|tsx|mts|cts|js|mjs|cjs|md|mdx|json|sql|toml|css|html|txt)$/;

// Files where "document" is something else by design.
const ALLOWED_FILES: readonly RegExp[] = [
  /^docs\/specs\/003-system-architecture\/domain-language\.md$/, // states this rule
  /^apps\/help\/lib\/project-naming\.test\.ts$/, // this guard
  /^packages\/icons\//, // paper icons' search words and labels
  /^packages\/licences\//, // third-party licence texts, kept verbatim
  /^packages\/render-png\/fonts\//, // a font's licence text
  /\/__fixtures__\/golden\//, // rendered view snapshots
  /^apps\/marketing\/lib\/(faq-content\.test\.tsx|product-claims\.test\.ts)$/, // guard the same rule for marketing copy
];

// The flowchart's document shape (ISO 5807): its kind, step type, labels and search words; and a Mermaid text document.
const FLOWCHART_DOCUMENT =
  /a document (or|and) a triangle|mid-document|['"]document['"]|\bdocuments?: |['"]Document['"]|flowchart "document"|'document' above|"document" +documents, reports/;

// The DOM's own document, in code or in prose about code.
const DOM_DOCUMENT =
  /\bdocument\??\.[A-Za-z]|\bdocument\s*$|^\s*document\s*$|typeof document|instanceof Document|\(document[,)]|stubGlobal\('document'|spyOn\(document|defineProperty\(document|= document\b|: Document\b|Document(Timeline|Fragment|OrShadowRoot)|DOM `?document|(HTML|SVG|XML) documents?\b|\(document as\b|\| Document\b|: document;|const document = \{|\{ document \}|^\s*document,$|`document`|document (position|root|element)\b|\.document\b|document\?: \{ createElement|without a document rather than throwing/;

// Search words for the page element, so someone typing "document" in the palette still finds it.
const PAGE_SEARCH_WORDS = /^\s*page: '[^']*\bdocument\b[^']*',$/;

// "document" on its own or inside a name (`documentId`, `listDocuments`), once the DOM's compound names and
// "documentation" are taken out.
const DOM_WORDS =
  /ownerDocument|contentDocument|documentElement|compareDocumentPosition|DOCUMENT_POSITION_\w+|createDocumentFragment|DocumentFragment|DocumentTimeline|DocumentOrShadowRoot|[Dd]ocumentation|[Uu]ndocumented|[Dd]ocumented|[Dd]ocumenting/g;
// Another liveworkspace app's own address for its items (livediagram's and livedocuments' `/document/`), which the
// shared Explorer opens on that app's site.
const OTHER_APP_PATHS = /^\s*(livediagram|livedocuments): '\/document\/',$/;
// livedocuments, the liveworkspace app whose items are Documents, named as the app it is.
const OTHER_APP_NAME = /\blivedocuments(\.app)?\b/g;
// A line stating the rule itself.
const RULE = /never "document"/;
const NAMED = /document/i;
const misnames = (line: string) =>
  NAMED.test(line.replace(DOM_WORDS, '').replace(OTHER_APP_NAME, '')) &&
  !DOM_DOCUMENT.test(line) &&
  !FLOWCHART_DOCUMENT.test(line) &&
  !PAGE_SEARCH_WORDS.test(line) &&
  !OTHER_APP_PATHS.test(line) &&
  !RULE.test(line);

function scannedFiles(): string[] {
  return (
    execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      // A file deleted in the working tree but not yet staged is still listed; it is not part of the change.
      .filter(
        (f) =>
          SCANNED.test(f) && !ALLOWED_FILES.some((re) => re.test(f)) && existsSync(`${ROOT}/${f}`),
      )
  );
}

describe('a project is never called a document', () => {
  it('names the container "project" in source, copy and docs', () => {
    const misnamed: string[] = [];
    for (const file of scannedFiles()) {
      const text = readFileSync(`${ROOT}/${file}`, 'utf8');
      if (!NAMED.test(text)) continue;
      text.split('\n').forEach((line, i) => {
        if (!misnames(line)) return;
        misnamed.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(misnamed).toEqual([]);
  });

  it('still sees the DOM document and the flowchart shape as allowed, and a container as not', () => {
    const flagged = misnames;
    expect(flagged('document.body.append(el);')).toBe(false);
    expect(flagged("fireEvent.keyDown(document, { key: 'Escape' });")).toBe(false);
    expect(flagged("  | 'document'")).toBe(false);
    expect(flagged("  page: 'file document paper doc',")).toBe(false);
    expect(flagged('Open the document from Explorer.')).toBe(true);
    expect(flagged('const documents = await listDocuments();')).toBe(true);
    expect(flagged('const id = row.documentId;')).toBe(true);
    expect(flagged('el.ownerDocument; // see the documentation')).toBe(false);
  });
});
