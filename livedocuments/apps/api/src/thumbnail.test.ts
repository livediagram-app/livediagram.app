import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@livedocuments/document';
import type { DocumentDTO, DocumentEnv, Env } from './types';

// A document drawn for liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md): the platform stores and serves it,
// so these pin only the drawing. The tab body comes through the db layer, mocked here; the renderers stay real,
// they're pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  // Placement grants (docs/specs/009-elements/images.md): by default every placed image is servable.
  servableImageIds: vi.fn(async (_env: unknown, _doc: string, ids: string[]) => new Set(ids)),
}));
vi.mock('./db', () => db);
// The images' bytes come from the media service (src/media.ts); here, from a stub each test arranges.
type StubImage = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
} | null;
const media = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./media', () => ({
  mediaClient: (env: Env) =>
    env.MEDIA_KEY
      ? {
          bytes: async (id: string) => {
            const object = (await media.get(id)) as StubImage;
            if (!object) return null;
            return {
              owner: '',
              contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
              body: new Response(await object.arrayBuffer()).body,
            };
          },
        }
      : null,
}));

import { drawDocument } from './thumbnail';

// A deploy with the media service, so a drawing inlines its images.
const ENV = { MEDIA_KEY: 'k' } as unknown as DocumentEnv;

const draw = (doc: DocumentDTO, tabId: string | null = null) => drawDocument(ENV, doc, tabId);

const PNG = {
  arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  httpMetadata: { contentType: 'image/png' },
};

function liveDoc(over: Partial<DocumentDTO> = {}): DocumentDTO {
  return {
    id: 'd1',
    ownerId: 'o1',
    name: 'Document',
    tabs: [],
    shareable: false,
    shareCode: null,
    folderId: null,
    presentation: null,
    teamId: null,
    source: null,
    savedAt: 1000,
    createdAt: 0,
    ownerName: null,
    ownerColor: null,
    ...over,
  };
}

// A one-shape first tab, in the on-disk `tabs.data` shape (body minus
// id + name — see db/tabs.ts upsertTab).
const TAB_DATA = JSON.stringify({
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }],
});

// A first tab as getTabBody returns it.
const stored = (data: string) => ({ id: 't1', data });

beforeEach(() => {
  vi.clearAllMocks();
  media.get.mockResolvedValue(null);
});

describe('drawDocument', () => {
  it('draws the first tab, or the one asked for', async () => {
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    expect(await draw(liveDoc())).toContain('<svg');
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1');
    await draw(liveDoc(), 't2');
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1', 't2');
  });

  it('draws nothing for an empty document, one with no tabs, or a body it cannot read', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] })));
    expect(await draw(liveDoc())).toBeNull();
    db.getTabBody.mockResolvedValue(null);
    expect(await draw(liveDoc())).toBeNull();
    db.getTabBody.mockResolvedValue(stored('not json'));
    expect(await draw(liveDoc())).toBeNull();
  });

  it('embeds a referenced image as a base64 data URL', async () => {
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'img-1' }],
    });
    db.getTabBody.mockResolvedValue(stored(tabData));
    media.get.mockImplementation(async (key: string) => (key === 'img-1' ? PNG : null));

    const out = await draw(liveDoc());

    expect(out).toContain('<image');
    // btoa of bytes [1,2,3,4] is "AQIDBA==".
    expect(out).toContain('data:image/png;base64,AQIDBA==');
    expect(out).not.toContain('stroke-dasharray="4 4"'); // not the placeholder
  });

  it('keeps the placeholder when the referenced image is gone, or there is no media service', async () => {
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'gone' }],
    });
    db.getTabBody.mockResolvedValue(stored(tabData));

    const out = await draw(liveDoc());
    expect(out).toContain('stroke-dasharray="4 4"'); // dashed placeholder
    expect(out).not.toContain('<image');
    expect(await drawDocument({} as DocumentEnv, liveDoc(), null)).toContain(
      'stroke-dasharray="4 4"',
    );
  });

  // An id the document may not serve (docs/specs/009-elements/images.md, "Placement grants")
  // is never read and keeps the placeholder.
  it('keeps the placeholder for an image the document may not serve, without reading it', async () => {
    const tabData = JSON.stringify({
      elements: [
        { id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'foreign' },
      ],
    });
    db.getTabBody.mockResolvedValue(stored(tabData));
    db.servableImageIds.mockResolvedValueOnce(new Set());
    media.get.mockResolvedValue(PNG);

    const out = await draw(liveDoc());

    expect(db.servableImageIds).toHaveBeenCalledWith(ENV, 'd1', ['foreign']);
    expect(media.get).not.toHaveBeenCalledWith('foreign');
    expect(out).toContain('stroke-dasharray="4 4"');
    expect(out).not.toContain('<image');
  });
});

// docs/specs/006-document/document-snapshots.md "Pages tabs": the first page alone, as an export draws it.
describe('a drawing of a Pages tab', () => {
  const A4 = { orientation: 'portrait', size: 'a4', kind: 'infographic' };
  const PICTURE = 'b'.repeat(32);
  const ON_FIRST = 'c'.repeat(32);
  const ON_SECOND = 'd'.repeat(32);
  // Two A4 pages side by side (the second starts past the first's 794px width), each with a labelled square and an
  // image; the first page has a picture background.
  const tabData = JSON.stringify({
    pages: [
      {
        id: 'p1',
        ...A4,
        background: { fill: { kind: 'image', imageId: PICTURE, tone: '#336699' } },
      },
      { id: 'p2', ...A4 },
    ],
    elements: [
      {
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: 40,
        y: 40,
        width: 100,
        height: 80,
        label: 'Cover',
      },
      { id: 'ia', type: 'image', x: 40, y: 200, width: 100, height: 80, imageId: ON_FIRST },
      {
        id: 'b',
        type: 'shape',
        shape: 'square',
        x: 2000,
        y: 40,
        width: 100,
        height: 80,
        label: 'Later',
      },
      { id: 'ib', type: 'image', x: 2000, y: 200, width: 100, height: 80, imageId: ON_SECOND },
    ],
  });

  beforeEach(() => {
    media.get.mockResolvedValue(PNG);
    db.getTabBody.mockResolvedValue(stored(tabData));
  });

  it('draws the first page alone, at its own size', async () => {
    const out = (await draw(liveDoc()))!;
    expect(out).toContain('Cover');
    expect(out).not.toContain('Later');
    // The page's own frame, not the bounds of everything on the canvas, nor the grid of every page.
    expect(out).toMatch(/^<svg [^>]*width="794" height="1123"/);
  });

  it("reads only the first page's images, its picture background among them", async () => {
    await draw(liveDoc());
    const read = media.get.mock.calls.map(([key]) => key as string);
    expect(read).toEqual(expect.arrayContaining([ON_FIRST, PICTURE]));
    expect(read).not.toContain(ON_SECOND);
  });

  it('skips a malformed stored page rather than failing the drawing', async () => {
    const parsed = JSON.parse(tabData) as { pages: unknown[] };
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ ...parsed, pages: [null, 5, ...parsed.pages] })),
    );
    const out = (await draw(liveDoc()))!;
    expect(out).toContain('Cover');
    expect(out).not.toContain('Later');
  });

  it('draws the first page for one tab too', async () => {
    const tabImage = (await draw(liveDoc(), 't1'))!;
    expect(tabImage).toContain('Cover');
    expect(tabImage).not.toContain('Later');
  });
});

// Stock colours are first-class (docs/specs/008-canvas/canvas-and-palette.md "Colours"): a drawing
// draws a colour stored by name in its version for the page, on any tab.
describe('a drawing of named stock colours', () => {
  it('draws Blue and Ink by name in the light page version', async () => {
    const shape = { type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 };
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          elements: [
            { ...shape, id: 'e1', penColour: 'blue' },
            { ...shape, id: 'e2', x: 200, penColour: 'ink' },
          ],
        }),
      ),
    );
    const out = await draw(liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});
