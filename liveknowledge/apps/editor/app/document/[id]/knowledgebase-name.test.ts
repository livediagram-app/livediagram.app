import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase": its name is "Untitled Knowledgebase"
// until a person names it. The fork named a still untitled document after the Title typed on its first page (and
// after its first label), so the sidebar's head and Home's card read "Release Process" once the first page had a
// title. Neither the writing nor a label may name the knowledgebase: a Title names its page (usePageNameFromTitle).
describe('what names the knowledgebase', () => {
  const read = (file: string) => readFileSync(`${__dirname}/${file}`, 'utf8');

  it('is not the writing: the articles slice never sets the name', () => {
    const src = read('editor-state/useEditorArticles.ts');
    expect(src).not.toMatch(/setDocumentName/);
    expect(src).not.toMatch(/onWritten\s*:/);
  });

  it('is not a label: committing one never sets the name', () => {
    expect(read('useSelectionEditing.ts')).not.toMatch(/setDocumentName\(/);
  });
});
