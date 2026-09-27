// @vitest-environment jsdom
import { isValidElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { anchor, boardHtml, inkGroup, inkStroke } from './__fixtures__/board-markup';
import { writeZip } from './__fixtures__/zip-writer';
import { importWhiteboard } from './import';

const stroke = (id: string, y: number) =>
  inkStroke(id, {
    points: [
      { x: 0, y },
      { x: 80, y: y + 5 },
    ],
    width: 3,
    rgba: [30, 60, 90, 1],
  });

const board = boardHtml([
  anchor({
    apikey: 'ink-1',
    left: 40,
    top: 40,
    content: inkGroup([stroke('a', 0), stroke('b', 20)]),
  }),
  anchor({ apikey: 'loop-1', type: 'LoopComponent', left: 0, top: 0, content: '<div></div>' }),
]);

describe('importWhiteboard', () => {
  it('imports a Full export Zip as elements with a report and a stable source id', async () => {
    const bytes = writeZip([
      { name: 'Retro.html', data: board },
      { name: 'Retro-comments.json', data: '{}' },
    ]);
    const result = await importWhiteboard({ name: 'Retro.zip', bytes });
    if (!result.ok || result.route !== 'board') throw new Error(JSON.stringify(result));
    expect(result.title).toBe('Retro');
    expect(result.elements).toHaveLength(2);
    expect(result.elements.every(isValidElement)).toBe(true);
    expect(result.tally.rows.map((r) => r.kind)).toEqual(['pen-stroke', 'LoopComponent']);
    expect(result.sourceId).toMatch(/^mswb:Retro:[0-9a-f]{8}$/);
    const again = await importWhiteboard({ name: 'Retro.zip', bytes });
    expect(again.ok && again.route === 'board' && again.sourceId).toBe(result.sourceId);
  });

  it('takes the picture route for a PNG', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const result = await importWhiteboard({ name: 'Retro.png', bytes: png });
    expect(result.ok && result.route === 'picture' && [result.title, result.mimeType]).toEqual([
      'Retro',
      'image/png',
    ]);
  });

  it('refuses a file past the size limit before reading it', async () => {
    const huge = { name: 'big.zip', bytes: new Uint8Array(0) };
    Object.defineProperty(huge.bytes, 'length', { value: 201 * 1024 * 1024 });
    expect(await importWhiteboard(huge)).toMatchObject({ ok: false, refusal: 'too-large' });
  });

  it('refuses with copy the dialog can show', async () => {
    const result = await importWhiteboard({
      name: 'notes.txt',
      bytes: new TextEncoder().encode('hello'),
    });
    expect(result).toEqual({
      ok: false,
      refusal: 'not-whiteboard',
      error:
        "This isn't a Microsoft Whiteboard export. Choose the Zip from Export, Full export, or the PNG.",
    });
  });

  it('refuses rather than throws on unexpected input', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(await importWhiteboard({ name: 'x.zip', bytes })).toMatchObject({
      ok: false,
      refusal: 'zip-damaged',
    });
  });
});
