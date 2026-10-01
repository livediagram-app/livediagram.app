// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ArrowElement, ShapeElement } from '@livediagram/document';
import { importDrawio } from './import';
import { jsonLabelText } from './json-export';
import { fixtureBytes } from './test-support';

// docs/specs/020-import-export/drawio-import.md "The JSON export". Exports synthesised here.

type Cell = Record<string, unknown>;
const page = (name: string, cells: Cell[]) => ({ id: `p-${name}`, name, cells });
const layer: Cell = { id: '1', type: 'layer', parent: '0' };
const node = (id: string, label: string, extra: Cell = {}): Cell => ({
  id,
  type: 'node',
  parent: '1',
  label,
  ...extra,
});
const edge = (id: string, source: string, target: string, label = ''): Cell => ({
  id,
  type: 'edge',
  parent: '1',
  source,
  target,
  label,
});
const exported = (pages: object[], data?: string) =>
  JSON.stringify({ version: '31.7.0', ...(data ? { data } : {}), pages });

const run = async (text: string) => {
  const r = await importDrawio({ kind: 'text', text }, { tabIdForPage: (i) => `tab-${i}` });
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('jsonLabelText', () => {
  it.each([
    ['Plain', 'Plain'],
    ['One<br>Two', 'One\nTwo'],
    ['<p>One</p><p>Two</p>', 'One\nTwo'],
    ['<div><b>Bold</b> and <i>italic</i></div><div>next</div>', 'Bold and italic\nnext'],
    ['<h1>Title</h1>Body', 'Title\nBody'],
    ['A &amp; B &lt;c&gt; &#8211; &#x2014;', 'A & B <c> – —'],
    ['<span style="color:red">red</span>', 'red'],
    ['One<br><br><br>Two', 'One\n\nTwo'],
    ['  <br> ', ''],
  ])('reads %j as %j', (html, text) => {
    expect(jsonLabelText(html)).toBe(text);
  });
});

describe('the JSON export', () => {
  it('imports the full diagram carried in `data`, exactly', async () => {
    const xml = fixtureBytes('flowchart.drawio');
    const viaData = await run(exported([page('Ignored', [layer])], new TextDecoder().decode(xml)));
    const direct = await importDrawio(
      { kind: 'bytes', bytes: xml },
      { tabIdForPage: (i) => `tab-${i}` },
    );
    if (!direct.ok) throw new Error(direct.error);
    expect(viaData.pages.map((p) => p.elements.length)).toEqual(
      direct.pages.map((p) => p.elements.length),
    );
    expect(viaData.report).toEqual(direct.report);
  });

  it('lays out a graph-only export, one tab per page, connections attached', async () => {
    const r = await run(
      exported([
        page('Flow', [
          layer,
          node('a', 'Start'),
          node('b', 'Middle<br>step'),
          node('c', '<b>End</b>'),
          edge('e1', 'a', 'b', 'next'),
          edge('e2', 'b', 'c'),
        ]),
        page('Empty', [layer]),
      ]),
    );
    expect(r.pages.map((p) => p.name)).toEqual(['Flow', 'Empty']);
    const [flow, empty] = r.pages;
    const shapes = flow!.elements.filter((e): e is ShapeElement => e.type === 'shape');
    const arrows = flow!.elements.filter((e): e is ArrowElement => e.type === 'arrow');
    expect(shapes.map((s) => s.label)).toEqual(['Start', 'Middle\nstep', 'End']);
    expect(arrows).toHaveLength(2);
    const byLabel = new Map(shapes.map((s) => [s.label, s.id]));
    expect(arrows[0]!.from).toMatchObject({ kind: 'pinned', elementId: byLabel.get('Start') });
    expect(arrows[0]!.to).toMatchObject({ kind: 'pinned', elementId: byLabel.get('Middle\nstep') });
    expect(arrows[0]!.label).toBe('next');
    // Laid out: not every box on the same spot.
    expect(new Set(shapes.map((s) => `${s.x},${s.y}`)).size).toBe(3);
    expect(empty!.elements).toEqual([]);
    // Fresh ids: none of the file's own.
    expect(flow!.elements.some((e) => ['a', 'b', 'c', 'e1', 'e2'].includes(e.id))).toBe(false);
    expect(r.report.notes).toEqual([{ kind: 'auto-layout', count: 1 }]);
    expect(r.report).toMatchObject({ pages: 2, elements: 5 });
  });

  it('keeps web and email links, drops other kinds, and drops edges to nowhere', async () => {
    const r = await run(
      exported([
        page('Links', [
          layer,
          node('a', 'Web', { metadata: { link: 'https://example.com/x' } }),
          node('b', 'Mail', { metadata: { link: 'mailto:team@example.com' } }),
          node('c', 'Page', { metadata: { link: 'data:page/id,other' } }),
          edge('e1', 'a', 'missing'),
        ]),
      ]),
    );
    const shapes = r.pages[0]!.elements.filter((e): e is ShapeElement => e.type === 'shape');
    expect(shapes.map((s) => s.link)).toEqual([
      { kind: 'url', url: 'https://example.com/x' },
      { kind: 'url', url: 'mailto:team@example.com' },
      undefined,
    ]);
    expect(r.pages[0]!.elements.some((e) => e.type === 'arrow')).toBe(false);
    expect(r.report.notes).toEqual([
      { kind: 'connection-loosened', count: 1 },
      { kind: 'link-dropped', count: 1 },
      { kind: 'auto-layout', count: 1 },
    ]);
  });

  it('reads a plain-text label as it is', async () => {
    const r = await run(exported([page('P', [layer, node('a', 'a < b\nnext', { html: 0 })])]));
    expect((r.pages[0]!.elements[0] as ShapeElement).label).toBe('a < b\nnext');
  });

  it('refuses JSON that is not a draw.io export', async () => {
    const r = await importDrawio(
      { kind: 'text', text: '{"type":"excalidraw","elements":[]}' },
      { tabIdForPage: () => 't' },
    );
    expect(r).toEqual({
      ok: false,
      error:
        "This isn't a draw.io file: it isn't a .drawio, a .drawio.png, a .drawio.svg or a draw.io JSON export.",
    });
  });
});
