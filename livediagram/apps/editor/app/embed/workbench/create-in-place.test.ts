import { beforeEach, describe, expect, it, vi } from 'vitest';

type CreateDocument = typeof import('@/lib/api-client').apiCreateDocument;
const api = vi.hoisted(() => ({ apiCreateDocument: vi.fn<CreateDocument>() }));
vi.mock('@/lib/api-client', () => api);

import { parseStoredPresentation } from '@livediagram/document';
import { TEMPLATE_SLIDES } from '@livediagram/templates';
import { createDocumentInPlace, createInPlaceOf } from './create-in-place';

const ORIGIN = 'https://live.test';
const HOME = { kind: 'explorer', node: { kind: 'home' } } as const;

describe('createInPlaceOf', () => {
  it('takes the wizard href’s place and template first', () => {
    expect(createInPlaceOf('/new?folder=f1&template=flowchart', ORIGIN, HOME)).toEqual({
      folderId: 'f1',
      teamId: null,
      templateKind: 'flowchart',
    });
    expect(createInPlaceOf('/new?team=t1', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: 't1',
      templateKind: null,
    });
  });

  it('fills in the place the frame shows when the href names none', () => {
    expect(
      createInPlaceOf('/new', ORIGIN, { kind: 'explorer', node: { kind: 'folder', id: 'f2' } }),
    ).toEqual({ folderId: 'f2', teamId: null, templateKind: null });
    expect(
      createInPlaceOf('/new?blank=1', ORIGIN, {
        kind: 'explorer',
        node: { kind: 'team', id: 't2' },
      }),
    ).toEqual({ folderId: null, teamId: 't2', templateKind: 'blank' });
    expect(createInPlaceOf('/new?q=roadmap', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: null,
      templateKind: null,
    });
  });
});

describe('createDocumentInPlace', () => {
  beforeEach(() => {
    api.apiCreateDocument.mockReset();
    api.apiCreateDocument.mockResolvedValue({} as never);
  });

  it('makes a blank that opens on the editor’s start, in the asked folder', async () => {
    const id = await createDocumentInPlace('user_1', {
      folderId: 'f1',
      teamId: null,
      templateKind: null,
    });

    const [owner, made] = api.apiCreateDocument.mock.calls[0]!;
    expect(owner).toBe('user_1');
    expect(made).toMatchObject({ id, name: 'Untitled canvas', folderId: 'f1', teamId: null });
    expect(made.tabs).toHaveLength(1);
    expect(made.tabs?.[0]?.templateChosen).toBeUndefined();
    expect(made.tabs?.[0]?.elements).toEqual([]);
  });

  it('makes the asked template as /new makes it', async () => {
    await createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: 'flowchart',
    });

    const [, made] = api.apiCreateDocument.mock.calls[0]!;
    expect(made.name).not.toBe('Untitled canvas');
    expect(made.tabs?.[0]?.templateChosen).toBe(true);
    expect(made.intent).toBeDefined();
    // A flowchart is not presented: no deck travels.
    expect(made).not.toHaveProperty('presentation');
  });

  it('seeds a presented template’s deck, its slides on the made tab', async () => {
    await createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: 'roadmap',
    });

    const [, made] = api.apiCreateDocument.mock.calls[0]!;
    const deck = parseStoredPresentation(made.presentation)?.decks[0];
    expect(deck?.slides.map((s) => s.name)).toEqual(TEMPLATE_SLIDES.roadmap!.map((s) => s.name));
    expect(deck?.slides.every((s) => s.tabId === made.tabs?.[0]?.id)).toBe(true);
  });

  it('lets a refused create through to the caller', async () => {
    const refused = new Error('403');
    api.apiCreateDocument.mockImplementation(async () => {
      throw refused;
    });

    const made = createDocumentInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: null,
    }).catch((err: unknown) => err);

    expect(await made).toBe(refused);
  });
});
