// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { importDrawio } from './import';
import { drawioDocumentSource } from './new-document';
import { fixtureBytes } from './test-support';

// docs/specs/020-import-export/drawio-import.md "Import as new documents": a draw.io file's pages
// become the diagram tabs of its own new document.

const store = vi.fn(async () => ({
  ok: true as const,
  imageId: 'img-1',
  width: 1,
  height: 1,
  kind: 'uploaded' as const,
}));
const createImageSession = vi.fn(async () => ({ store }));

async function imported(name: string) {
  const r = await importDrawio(
    { kind: 'bytes', bytes: fixtureBytes(name) },
    { tabIdForPage: () => crypto.randomUUID() },
  );
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('drawioDocumentSource', () => {
  it('makes every page a diagram tab of one document, in page order', async () => {
    const r = await imported('multi-page.drawio');
    const source = drawioDocumentSource(
      { name: 'Platform', modifiedAt: '2026-03-12T10:00:00Z', ...r },
      { ownerId: 'o', offline: false, createImageSession },
    );
    expect(source).toMatchObject({
      name: 'Platform',
      kind: 'diagram',
      createdAt: '2026-03-12T10:00:00Z',
      modifiedAt: '2026-03-12T10:00:00Z',
    });
    const prepared = await source.prepare(() => {});
    if ('error' in prepared) throw new Error(prepared.error);
    expect(prepared.tabs.map((t) => t.name)).toEqual(['Overview', 'Detail', 'Scratch']);
    expect(prepared.tabs.map((t) => t.id)).toEqual(r.pages.map((p) => p.tabId));
    expect(prepared.tabs.every((t) => t.templateChosen === true && t.kind === undefined)).toBe(
      true,
    );
    expect(prepared.tabs[0]!.elements).toEqual(r.pages[0]!.elements);
    // The shared report: every page's elements counted, with what changed.
    const landed = Object.values(prepared.report.landed).reduce((a, n) => a + (n ?? 0), 0);
    expect(landed).toBe(r.report.elements);
    expect(createImageSession).not.toHaveBeenCalled();
  });

  it('stores the embedded images through one pipeline pass first', async () => {
    const r = await imported('cloud-architecture.drawio');
    const progress = vi.fn();
    const prepared = await drawioDocumentSource(
      { name: 'Cloud', ...r },
      { ownerId: 'o', offline: false, createImageSession },
    ).prepare(progress);
    if ('error' in prepared) throw new Error(prepared.error);
    expect(createImageSession).toHaveBeenCalledWith({
      ownerId: 'o',
      documentId: null,
      offline: false,
    });
    expect(store).toHaveBeenCalledTimes(1);
    expect(prepared.images).toMatchObject({ imported: 1 });
    const image = prepared.tabs[0]!.elements.find((e) => e.type === 'image' && e.imageId);
    expect(image).toMatchObject({ imageId: 'img-1' });
    expect(progress).toHaveBeenLastCalledWith({ done: 1, total: 1 });
  });
});
