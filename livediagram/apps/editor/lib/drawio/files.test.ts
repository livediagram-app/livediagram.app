// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { drawioFileDates, drawioFileTitle, drawioLibraryTitle, readDrawioFiles } from './files';
import { fixtureBytes } from './test-support';

// docs/specs/020-import-export/drawio-import.md "Import as new documents": names, dates, kinds.

const file = (name: string, body: string | Uint8Array, lastModified = Date.UTC(2026, 2, 12)) =>
  new File([typeof body === 'string' ? body : Uint8Array.from(body)], name, { lastModified });
const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const model =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
const mxfile = (attrs: string, pages: string[]) =>
  `<mxfile host="app.diagrams.net"${attrs}>${pages.map((p) => `<diagram name="${p}">${compress(model)}</diagram>`).join('')}</mxfile>`;

describe('drawioFileTitle', () => {
  const at = '2026-04-12T09:30:00.000Z';
  it.each([
    ['Roadmap.drawio', 'Roadmap'],
    ['Roadmap.DRAWIO.PNG', 'Roadmap'],
    ['Roadmap.drawio.svg', 'Roadmap'],
    ['Roadmap.xml', 'Roadmap'],
    ['Roadmap.json', 'Roadmap'],
    ['Roadmap', 'Roadmap'],
    ['Network v2.png', 'Network v2'],
  ])('names %j %j', (name, title) => {
    expect(drawioFileTitle(name, {}, 'Page-1', at)).toBe(title);
  });

  it.each([
    'Untitled Diagram.drawio',
    'untitled',
    'Diagram (2).xml',
    'drawing-3.drawio',
    '.drawio',
  ])(
    'looks past the generic %j to the file name inside, then the first page, then the date',
    (name) => {
      expect(drawioFileTitle(name, { name: 'Roadmap' }, 'Page-1', at)).toBe('Roadmap');
      expect(drawioFileTitle(name, { name: 'Untitled Diagram' }, 'Systems', at)).toBe('Systems');
      expect(drawioFileTitle(name, {}, 'Page-1', at)).toBe('draw.io diagram, 12 Apr 2026');
      expect(drawioFileTitle(name, {}, '', undefined)).toBe('draw.io diagram');
    },
  );
});

describe('drawioLibraryTitle', () => {
  it('is the file name, or "draw.io library" for a generic one', () => {
    expect(drawioLibraryTitle('Team icons.xml')).toBe('Team icons');
    expect(drawioLibraryTitle('Untitled Library (3).xml')).toBe('draw.io library');
    expect(drawioLibraryTitle('')).toBe('draw.io library');
  });
});

describe('drawioFileDates', () => {
  it("takes the file's modified attribute, created the same moment", () => {
    expect(drawioFileDates('2026-03-12T10:00:00.000Z', Date.UTC(2020, 0, 1))).toEqual({
      createdAt: '2026-03-12T10:00:00.000Z',
      modifiedAt: '2026-03-12T10:00:00.000Z',
    });
  });

  it("falls back to the file's own time, and to nothing", () => {
    const own = new Date(Date.UTC(2025, 5, 1)).toISOString();
    expect(drawioFileDates('not a date', Date.UTC(2025, 5, 1))).toEqual({
      createdAt: own,
      modifiedAt: own,
    });
    expect(drawioFileDates(undefined, 0)).toEqual({});
  });
});

describe('readDrawioFiles', () => {
  it('sorts the picked files into diagrams, libraries and failures, in pick order', async () => {
    const read = await readDrawioFiles([
      // A Drive save: no extension, compressed pages, the save moment in `modified`.
      file('Roadmap', mxfile(' modified="2026-03-12T10:00:00.000Z"', ['One', 'Two', 'Three'])),
      file('notes.txt', 'hello'),
      file(
        'Team icons.xml',
        `<mxlibrary>${JSON.stringify([{ xml: compress(model), w: 80, h: 40, title: 'A' }])}</mxlibrary>`,
      ),
      file('flowchart.drawio.png', fixtureBytes('flowchart.drawio.png')),
      file('broken.drawio', '<mxfile><diagram name="X">!!!</diagram></mxfile>'),
    ]);
    expect(read.diagrams.map((d) => [d.name, d.pages.map((p) => p.name), d.modifiedAt])).toEqual([
      ['Roadmap', ['One', 'Two', 'Three'], '2026-03-12T10:00:00.000Z'],
      ['flowchart', expect.any(Array), new Date(Date.UTC(2026, 2, 12)).toISOString()],
    ]);
    expect(read.diagrams[0]!.createdAt).toBe('2026-03-12T10:00:00.000Z');
    expect(new Set(read.diagrams.flatMap((d) => d.pages.map((p) => p.tabId))).size).toBe(
      read.diagrams.reduce((n, d) => n + d.pages.length, 0),
    );
    expect(read.libraries.map((l) => [l.name, l.items.length])).toEqual([['Team icons', 1]]);
    expect(read.failures).toEqual([
      { title: 'notes.txt', message: "This file isn't a draw.io diagram or library." },
      { title: 'broken', message: "Page 'X' couldn't be decoded." },
    ]);
  });

  it('reads a JSON export like any diagram', async () => {
    const json = JSON.stringify({
      version: '31.7.0',
      pages: [
        { id: 'p', name: 'Flow', cells: [{ id: 'n', type: 'node', parent: '1', label: 'A' }] },
      ],
    });
    const read = await readDrawioFiles([file('export.json', json)]);
    expect(read.diagrams.map((d) => [d.name, d.pages.length])).toEqual([['export', 1]]);
  });
});
