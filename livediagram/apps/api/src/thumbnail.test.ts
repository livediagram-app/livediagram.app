import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@livediagram/document';
import type { DocumentDTO, DocumentEnv, Env } from './types';

// A canvas drawn for liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md): the platform stores and serves it, so
// these pin only the drawing. The tab body and its count stamp come through the db layer, mocked here;
// renderElementsToSvg stays real, it's pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  stampTabElementCount: vi.fn(),
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

function draw(
  doc: DocumentDTO,
  opts: { tabId?: string | null; community?: boolean; defer?: (p: Promise<unknown>) => void } = {},
): Promise<string | null> {
  return drawDocument(
    ENV,
    doc,
    opts.tabId ?? null,
    opts.defer ? { defer: opts.defer } : {},
    opts.community ?? false,
  );
}

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
    // No recorded creation intent (docs/specs/013-workspace/default-folders.md).
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    ...over,
  };
}

// A one-shape first tab, in the on-disk `tabs.data` shape (body minus
// id + name — see db/tabs.ts upsertTab).
const TAB_DATA = JSON.stringify({
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }],
});

// A first tab as getTabBody returns it; its count is known unless the test says otherwise.
const stored = (data: string, elementCount: number | null = 1) => ({
  id: 't1',
  data,
  elementCount,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.stampTabElementCount.mockResolvedValue(undefined);
  media.get.mockResolvedValue(null);
});

describe('drawDocument', () => {
  it('draws the first tab, or the one asked for', async () => {
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    expect(await draw(liveDoc())).toContain('<svg');
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1');
    await draw(liveDoc(), { tabId: 't2' });
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1', 't2');
  });

  it('draws nothing for an empty document, one with no tabs, or a body it cannot read', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    expect(await draw(liveDoc())).toBeNull();
    db.getTabBody.mockResolvedValue(null);
    expect(await draw(liveDoc())).toBeNull();
    db.getTabBody.mockResolvedValue(stored('not json'));
    expect(await draw(liveDoc())).toBeNull();
  });

  // The lazy backfill (migration 0059): a tab stored before the count existed gets it from this parse,
  // so an old empty document is asked for at most once.
  it('records an unknown count from the body it parsed, empty or drawn', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    expect(await draw(liveDoc())).toBeNull();
    expect(db.stampTabElementCount).toHaveBeenCalledWith(ENV, 't1', 0);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA, null));
    expect(await draw(liveDoc())).toContain('<svg');
    expect(db.stampTabElementCount).toHaveBeenLastCalledWith(ENV, 't1', 1);
  });

  // Plan left livediagram for liveplanner: a stored Board or Form tab reads as a Diagram tab without its Plan board
  // or its form (dropRetiredPlan), so it has nothing to draw.
  it('draws nothing for a former Board or Form tab', async () => {
    const board = {
      id: 'b1',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 1400,
      height: 720,
    };
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ kind: 'board', elements: [board] })));
    expect(await draw(liveDoc())).not.toContain('plan-board');
    const form = { v: 1, heading: 'Contact Us', sections: [] };
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ kind: 'form', elements: [], form }), null),
    );
    expect(await draw(liveDoc())).toBeNull();
  });

  it('writes nothing for a count already known, or a body it cannot count', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    await draw(liveDoc());
    db.getTabBody.mockResolvedValue(stored('not json', null));
    expect(await draw(liveDoc())).toBeNull();
    expect(db.stampTabElementCount).not.toHaveBeenCalled();
  });

  it('hands the count stamp to `defer`, and a failed stamp never fails the drawing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    db.stampTabElementCount.mockRejectedValue(new Error('d1 busy'));
    const deferred: Promise<unknown>[] = [];
    expect(await draw(liveDoc(), { defer: (p) => deferred.push(p) })).toBeNull();
    expect(deferred).toHaveLength(1);
    await deferred[0];
    expect(warn).toHaveBeenCalledWith(
      '[thumbnail] count stamp failed',
      expect.objectContaining({ tabId: 't1' }),
    );
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

// Pages mode moved out to livedocuments: a tab stored in it previews as a Diagram tab, every ordinary element drawn and
// its pages (and their pictures) left behind (@livediagram/document retired-pages).
describe('a drawing of a former Pages tab', () => {
  const A4 = { orientation: 'portrait', size: 'a4', kind: 'infographic' };
  const PICTURE = 'b'.repeat(32);
  const ON_FIRST = 'c'.repeat(32);
  const ON_SECOND = 'd'.repeat(32);
  // Two A4 pages side by side (the second starts past the first's 794px width), each with a labelled square and an
  // image; the first page has a picture background.
  const tabData = JSON.stringify({
    opensIn: 'pages',
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

  it("draws every element, as a Diagram tab draws, and reads only the elements' images", async () => {
    media.get.mockResolvedValue(PNG);
    db.getTabBody.mockResolvedValue(stored(tabData, 4));
    const out = (await draw(liveDoc()))!;
    expect(out).toContain('Cover');
    expect(out).toContain('Later');
    const read = media.get.mock.calls.map(([key]) => key as string);
    expect(read).toEqual(expect.arrayContaining([ON_FIRST, ON_SECOND]));
    expect(read).not.toContain(PICTURE);
  });
});

// Retired schemes (docs/specs/011-theme/retired-schemes.md): the thumbnail parses `tabs.data` itself,
// so it runs the same stored-tab migration as every other read.
describe('a drawing of a Charcoal tab', () => {
  it('renders the migrated tab, not the colours Charcoal baked', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          theme: 'charcoal',
          backgroundColor: '#2b2b33',
          patternColor: '#636373',
          elements: [
            {
              id: 'e1',
              type: 'shape',
              shape: 'square',
              x: 0,
              y: 0,
              width: 100,
              height: 80,
              fillColor: '#2c2c33',
            },
          ],
        }),
      ),
    );
    const out = await draw(liveDoc());
    expect(out).not.toContain('#2c2c33');
    expect(out).toContain('#0d121a');
  });
});

// Stock colours are first-class (docs/specs/007-editor/editor-modes.md "One look"): a thumbnail
// draws a colour stored by name in its version for the page, on any tab, whatever mode drew it.
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
        2,
      ),
    );
    const out = await draw(liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});

// docs/specs/025-community/community.md "Viewing a post's document": a drawing through the post's link is drawn from
// the redacted tab, so a comment thread and its people never reach the public card image.
describe("a Community post's drawing", () => {
  const COMMENTED = JSON.stringify({
    elements: [
      {
        id: 'c1',
        type: 'shape',
        shape: 'comment-pin',
        x: 0,
        y: 0,
        width: 260,
        height: 200,
        commentThread: {
          comments: [
            {
              id: 'm1',
              text: 'Secret launch plan',
              authorId: 'user_jane',
              authorName: 'Jane Doe',
              authorColor: '#0ea5e9',
              createdAt: 1,
            },
          ],
        },
      },
      {
        id: 'e1',
        type: 'shape',
        shape: 'square',
        x: 300,
        y: 0,
        width: 100,
        height: 80,
        label: 'Public box',
      },
    ],
  });

  it("draws without the conversation the owner's drawing shows, on any tab", async () => {
    db.getTabBody.mockResolvedValue(stored(COMMENTED, 2));
    expect(await draw(liveDoc())).toContain('Secret launch plan');

    const community = await draw(liveDoc(), { community: true });
    // The rest of the board still draws (labels wrap, so one word of it).
    expect(community).toContain('Public');
    expect(community).not.toContain('Secret launch plan');
    expect(community).not.toContain('Jane Doe');
    expect(await draw(liveDoc(), { tabId: 't1', community: true })).not.toContain(
      'Secret launch plan',
    );
  });
});
