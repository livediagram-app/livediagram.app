import { describe, expect, it } from 'vitest';
import type { ArrowElement, ShapeElement, Tab } from '@livediagram/diagram';
import {
  TAB_SCHEMA_VERSION,
  exportTabAsJson,
  exportTabAsMarkdown,
  type ExportedTabEnvelope,
} from './export-tab';
import { parseImportedTab } from './import-tab';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

const pinnedArrow = (id: string, fromId: string, toId: string, label?: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
  to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  ...(label ? { label } : {}),
});

const tab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'My Tab',
  elements: [],
  ...overrides,
});

const text = (blob: Blob) => blob.text();

describe('exportTabAsJson', () => {
  it('wraps the tab in a versioned envelope', async () => {
    const blob = exportTabAsJson(tab());
    expect(blob.type).toBe('application/json');
    const env = JSON.parse(await text(blob)) as ExportedTabEnvelope;
    expect(env.kind).toBe('livediagram.tab');
    expect(env.schemaVersion).toBe(TAB_SCHEMA_VERSION);
    expect(typeof env.exportedAt).toBe('number');
    expect(env.tab.id).toBe('tab-1');
  });

  it('round-trips cleanly back through parseImportedTab', async () => {
    const original = tab({ elements: [shape('a', { label: 'Box' })] });
    const result = parseImportedTab(await text(exportTabAsJson(original)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tab).toEqual(original);
  });
});

describe('exportTabAsMarkdown', () => {
  it('uses the tab name as the H1 heading', async () => {
    const md = await text(exportTabAsMarkdown(tab({ name: 'Architecture' })));
    expect(md.startsWith('# Architecture\n')).toBe(true);
    expect(blobType(exportTabAsMarkdown(tab()))).toBe('text/markdown');
  });

  it('falls back to "Untitled tab" when the name is empty', async () => {
    const md = await text(exportTabAsMarkdown(tab({ name: '' })));
    expect(md.startsWith('# Untitled tab')).toBe(true);
  });

  it('emits "_No labelled content._" for an empty tab', async () => {
    const md = await text(exportTabAsMarkdown(tab()));
    expect(md).toContain('_No labelled content._');
    expect(md).not.toContain('## Elements');
    expect(md).not.toContain('## Connections');
  });

  it('lists each labelled boxed element as a bold bullet with a type tag', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'Alpha' }),
            shape('b', {}), // no label → skipped
            shape('c', { label: 'Gamma', y: 200 }),
          ],
        }),
      ),
    );
    expect(md).toContain('## Elements');
    expect(md).toContain('- **Alpha** (square)');
    expect(md).toContain('- **Gamma** (square)');
    // The unlabelled element contributes no bullet.
    expect(md.match(/^- \*\*/gm)?.length).toBe(2);
  });

  it('orders elements top-to-bottom then left-to-right (y, then x)', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('right', { label: 'Right', x: 300, y: 0 }),
            shape('left', { label: 'Left', x: 0, y: 0 }),
            shape('below', { label: 'Below', x: 0, y: 300 }),
          ],
        }),
      ),
    );
    const idxLeft = md.indexOf('Left');
    const idxRight = md.indexOf('Right');
    const idxBelow = md.indexOf('Below');
    expect(idxLeft).toBeLessThan(idxRight); // same y-band, left first
    expect(idxRight).toBeLessThan(idxBelow); // higher band before lower
  });

  it('renders labelled arrows in a Connections section using endpoint labels', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'A' }),
            shape('b', { label: 'B', x: 300 }),
            pinnedArrow('e1', 'a', 'b', 'calls'),
          ],
        }),
      ),
    );
    expect(md).toContain('## Connections');
    expect(md).toContain('- *calls*: A → B');
  });

  it('falls back to "?" for an arrow endpoint whose target is unlabelled', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'A' }),
            shape('b', {}), // unlabelled target
            pinnedArrow('e1', 'a', 'b', 'calls'),
          ],
        }),
      ),
    );
    expect(md).toContain('- *calls*: A → ?');
  });

  it('drops unlabelled arrows entirely (no Connections section)', async () => {
    const md = await text(
      exportTabAsMarkdown(
        tab({
          elements: [
            shape('a', { label: 'A' }),
            shape('b', { label: 'B', x: 300 }),
            pinnedArrow('e1', 'a', 'b'), // no label
          ],
        }),
      ),
    );
    expect(md).not.toContain('## Connections');
  });
});

function blobType(blob: Blob): string {
  return blob.type;
}
