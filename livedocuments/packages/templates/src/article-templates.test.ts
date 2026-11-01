import { describe, expect, it } from 'vitest';
import { articleTocEntries, type ArticleBlock } from '@livedocuments/document';
import {
  articleTemplateOverridesFor,
  isArticleTemplate,
  type ArticleTemplateKind,
} from './article-templates';
import { templateCanvasOverrides } from './template-canvas-overrides';

// docs/specs/008-canvas/canvas-and-palette.md "Written documents".
const KINDS: readonly ArticleTemplateKind[] = [
  'meeting-notes',
  'lesson-plan',
  'business-proposal',
  'design-doc',
  'status-report',
  'cover-letter',
];

const flowOf = (kind: ArticleTemplateKind) => {
  const o = articleTemplateOverridesFor(kind);
  expect(o.pages).toEqual([expect.objectContaining({ kind: 'article' })]);
  const flow = o.pages![0]!.flow!;
  return o.articles![flow]!;
};
const text = (b: ArticleBlock) => ('runs' in b ? b.runs.map((r) => r.text).join('') : '');
const tables = (blocks: readonly ArticleBlock[]) => blocks.filter((b) => b.type === 'table');

describe('the written templates', () => {
  it('each open on one article page of their own writing, a title and subtitle first', () => {
    const flows = new Set<string>();
    for (const kind of KINDS) {
      const o = templateCanvasOverrides(kind);
      expect(o.pages, kind).toHaveLength(1);
      flows.add(o.pages![0]!.flow!);
      const { blocks } = flowOf(kind);
      expect(blocks[0], kind).toMatchObject({ type: 'paragraph', style: 'title' });
      expect(blocks[1], kind).toMatchObject({ type: 'paragraph', style: 'subtitle' });
      // Every block has its own id, the same on every build.
      const ids = blocks.map((b) => b.id);
      expect(new Set(ids).size, kind).toBe(ids.length);
      expect(flowOf(kind).blocks.map((b) => b.id)).toEqual(ids);
      // No raw Markdown survives the read.
      expect(blocks.map(text).join(' '), kind).not.toMatch(/\*\*|^#|\[ \]|\[TOC/);
    }
    expect(flows.size).toBe(KINDS.length);
  });

  it('use tables where the document would, each column its own share', () => {
    const counts = Object.fromEntries(KINDS.map((k) => [k, tables(flowOf(k).blocks).length]));
    expect(counts).toEqual({
      'meeting-notes': 2,
      'lesson-plan': 1,
      'business-proposal': 2,
      'design-doc': 1,
      'status-report': 2,
      'cover-letter': 0,
    });
    for (const kind of KINDS)
      for (const t of tables(flowOf(kind).blocks)) {
        if (t.type !== 'table') continue;
        expect(t.header, kind).toBe(true);
        const sum = t.cols.reduce((n, c) => n + c.w, 0);
        expect(sum, kind).toBeCloseTo(1, 3);
      }
    const [timings] = tables(flowOf('lesson-plan').blocks);
    expect(timings?.type === 'table' && timings.cols.map((c) => c.w)).toEqual([0.18, 0.32, 0.5]);
  });

  it('lead the proposal and the design doc with a table of contents over their headings', () => {
    for (const kind of ['business-proposal', 'design-doc'] as const) {
      const { blocks } = flowOf(kind);
      const toc = blocks.find((b) => b.type === 'toc');
      expect(toc, kind).toBeDefined();
      expect(
        articleTocEntries(blocks, toc?.type === 'toc' && toc.depth ? toc.depth : 3).length,
      ).toBeGreaterThan(4);
    }
    // The proposal's title page stands alone, with no header or footer.
    const proposal = flowOf('business-proposal');
    expect(proposal.blocks.filter((b) => b.type === 'pageBreak')).toHaveLength(1);
    expect(proposal.style).toMatchObject({
      look: 'report',
      differentFirstPage: true,
      footer: { right: 'Page {page} of {pages}' },
    });
    expect(flowOf('design-doc').blocks.some((b) => b.type === 'code')).toBe(true);
  });

  it('carry the header, footer and look a document of their kind would', () => {
    expect(flowOf('meeting-notes').style).toMatchObject({
      header: { left: '{name}', right: '{date}' },
      pageNumbers: true,
    });
    expect(flowOf('lesson-plan').style).toMatchObject({
      look: 'notebook',
      footer: { right: 'Page {page}' },
    });
    expect(flowOf('status-report').style?.footer?.right).toBe('Page {page} of {pages}');
    expect(flowOf('cover-letter').style).toEqual({ look: 'classic', margins: 'wide' });
    // Actions as a to-do list.
    expect(
      flowOf('meeting-notes').blocks.filter((b) => b.type === 'list' && b.list === 'todo').length,
    ).toBe(4);
  });

  it('names only the written templates', () => {
    for (const kind of KINDS) expect(isArticleTemplate(kind)).toBe(true);
    expect(isArticleTemplate('article')).toBe(false);
    expect(isArticleTemplate('working-backwards')).toBe(false);
  });
});
