import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import {
  mindMarkdownToMarks,
  mindMarksToMarkdown,
  mindNodeMarks,
  mindRichTextFor,
  restyleMindNode,
} from './mind-outline-marks';
import { applyMindOutline, summariseMindOutline, type MindOutlineDress } from './mind-outline';
import { parseMindOutline } from './mind-outline-text';
import type { Element, ShapeElement } from './index';

// Bold, italic and underline in an outline (docs/specs/009-elements/mind-node.md "Edit Outline").

const node = (extra: Partial<ShapeElement>) =>
  ({ ...(createShape('mind-node', 0, 0) as ShapeElement), id: 'n', ...extra }) as ShapeElement;

describe('mindMarkdownToMarks', () => {
  it('reads bold, italic and underline', () => {
    expect(mindMarkdownToMarks('a **b** _c_ *d* __e__ <u>f</u>')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'd', italic: true },
      { text: ' ' },
      { text: 'e', bold: true },
      { text: ' ' },
      { text: 'f', underline: true },
    ]);
  });

  it('nests marks', () => {
    expect(mindMarkdownToMarks('<u>**_all_**</u>')).toEqual([
      { text: 'all', bold: true, italic: true, underline: true },
    ]);
  });

  it('leaves a lone marker, an inner underscore and a spaced star as text', () => {
    expect(mindMarkdownToMarks('2 * 3 * 4')).toEqual([{ text: '2 * 3 * 4' }]);
    expect(mindMarkdownToMarks('snake_case_name')).toEqual([{ text: 'snake_case_name' }]);
    expect(mindMarkdownToMarks('**open')).toEqual([{ text: '**open' }]);
  });

  it('keeps the text of code, links, escapes and a task box', () => {
    expect(mindMarkdownToMarks('[x] `a*b` [site](http://x.y) \\*not\\*')).toEqual([
      { text: 'a*b site *not*' },
    ]);
  });
});

describe('mindMarksToMarkdown', () => {
  it('writes marks that read back the same, with literals escaped', () => {
    const marks = [
      { text: 'Plain *star* ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'both ', italic: true, underline: true },
      { text: '_edge' },
    ];
    const md = mindMarksToMarkdown(marks);
    expect(md).toBe('Plain \\*star\\* **bold** and <u>*both*</u> \\_edge');
    expect(mindMarkdownToMarks(md)).toEqual([
      { text: 'Plain *star* ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'both', italic: true, underline: true },
      { text: ' _edge' },
    ]);
  });
});

describe('a node and its marks', () => {
  it('reads a node made bold by its style as bold throughout', () => {
    expect(mindNodeMarks(node({ label: 'Hi', textBold: true }))).toEqual([
      { text: 'Hi', bold: true },
    ]);
  });

  it('restyles a node, keeping its other formatting', () => {
    const n = node({ label: 'Red text', richText: [{ text: 'Red text', color: '#dc2626' }] });
    expect(restyleMindNode(n, [{ text: 'Red', bold: true }, { text: ' text' }])).toEqual([
      { text: 'Red', color: '#dc2626', bold: true },
      { text: ' text', color: '#dc2626' },
    ]);
  });

  it('writes a mark against the node style: unbolding a bold node is an explicit off', () => {
    expect(mindRichTextFor(node({ textBold: true }), 'Hi', [{ text: 'Hi' }])).toEqual([
      { text: 'Hi', bold: false },
    ]);
    expect(mindRichTextFor(node({}), 'Hi', [{ text: 'Hi' }])).toBeUndefined();
  });
});

describe('saving marks', () => {
  const map = (): Element[] => [
    node({ id: 'root', label: 'Root', mindFlow: 'tree' }),
    node({ id: 'a', label: 'Idea', mindParentId: 'root' }),
  ];
  const dress: MindOutlineDress = { newId: () => 'new', node: (n) => n, connector: (a) => a };

  it('counts a formatting change as restyled, not renamed, and applies it', () => {
    const outline = parseMindOutline('Root\n- **Idea**')!;
    expect(summariseMindOutline(map(), 'root', outline)).toMatchObject({
      renamed: 0,
      restyled: 1,
    });
    const out = applyMindOutline(map(), 'root', outline, dress)!;
    const idea = out.find((e) => e.id === 'a') as ShapeElement;
    expect(idea.label).toBe('Idea');
    expect(idea.richText).toEqual([{ text: 'Idea', bold: true }]);
  });

  it('moves nothing when only text or formatting changes', () => {
    const placed = map().map((e, i) => ({ ...e, x: 500 + i * 37, y: -90 * i }) as Element);
    const out = applyMindOutline(placed, 'root', parseMindOutline('Root\n- **Big idea**')!, dress)!;
    for (const el of placed) {
      const after = out.find((e) => e.id === el.id) as ShapeElement;
      expect([after.x, after.y]).toEqual([(el as ShapeElement).x, (el as ShapeElement).y]);
    }
  });

  it('gives a new node the formatting written on its line', () => {
    const out = applyMindOutline(
      map(),
      'root',
      parseMindOutline('Root\n- Idea\n- <u>New</u>')!,
      dress,
    )!;
    const fresh = out.find((e) => e.type === 'shape' && e.label === 'New') as ShapeElement;
    expect(fresh.richText).toEqual([{ text: 'New', underline: true }]);
  });
});
