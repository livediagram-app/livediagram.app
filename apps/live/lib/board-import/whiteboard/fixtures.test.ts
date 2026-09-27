// @vitest-environment jsdom
// The fixture corpus through the whole importer: every element valid, every
// item accounted for (docs/specs/020-import-export/blueprints/whiteboard-import.md "Testing").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { importWhiteboard } from './import';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, '__fixtures__', name)));

describe('synth-busy-board', () => {
  it('imports the Zip and the extracted HTML alike', async () => {
    const fromZip = await importWhiteboard({
      name: 'synth-busy-board.zip',
      bytes: fixture('synth-busy-board.zip'),
    });
    const fromHtml = await importWhiteboard({
      name: 'synth-busy-board.html',
      bytes: fixture('synth-busy-board.html'),
    });
    if (!fromZip.ok || fromZip.route !== 'board') throw new Error('zip failed');
    if (!fromHtml.ok || fromHtml.route !== 'board') throw new Error('html failed');
    expect(fromHtml.tally).toEqual(fromZip.tally);
    expect(fromHtml.elements.length).toBe(fromZip.elements.length);
  });

  it('accounts for every item and keeps every element valid', async () => {
    const result = await importWhiteboard({
      name: 'synth-busy-board.zip',
      bytes: fixture('synth-busy-board.zip'),
    });
    if (!result.ok || result.route !== 'board') throw new Error('import failed');
    expect(result.elements.every(isValidElement)).toBe(true);
    expect(result.tally.rows).toEqual([
      { kind: 'pen-stroke', imported: 4, degraded: { 'ink-outline': 1 }, skipped: 0 },
      { kind: 'highlighter-stroke', imported: 1, degraded: {}, skipped: 0 },
      { kind: 'Note', imported: 0, degraded: {}, skipped: 1 },
    ]);
    expect(result.simplified).toBe(false);
  });
});
